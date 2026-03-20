import { db, auth, storage } from './firebase-config.js'
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'firebase/auth'
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, orderBy, serverTimestamp
} from 'firebase/firestore'
import {
  ref, uploadBytes, getDownloadURL
} from 'firebase/storage'
import DOMPurify from 'dompurify'

// ===== State =====
let currentPostId = null
let quillEditor = null
let autoSaveTimer = null
let currentTestimonialId = null
let testimonialAutoSaveTimer = null
let currentTestimonialThumbnailUrl = null

// ===== DOM Elements =====
const loginView = document.getElementById('login-view')
const dashboardView = document.getElementById('dashboard-view')
const editorView = document.getElementById('editor-view')
const testimonialEditorView = document.getElementById('testimonial-editor-view')

// ===== Auth =====
onAuthStateChanged(auth, (user) => {
  if (user) {
    showView('dashboard')
    document.getElementById('user-email').textContent = user.email
    loadPostsList()
    loadTestimonialsList()
  } else {
    showView('login')
  }
})

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  const errorEl = document.getElementById('login-error')
  errorEl.textContent = ''

  try {
    await signInWithEmailAndPassword(auth, email, password)
  } catch (err) {
    errorEl.textContent = 'ログインに失敗しました。メールアドレスとパスワードを確認してください。'
  }
})

document.getElementById('logout-btn').addEventListener('click', () => {
  signOut(auth)
})

// ===== View Management =====
function showView(view) {
  loginView.style.display = view === 'login' ? 'block' : 'none'
  dashboardView.style.display = view === 'dashboard' ? 'block' : 'none'
  editorView.style.display = view === 'editor' ? 'block' : 'none'
  testimonialEditorView.style.display = view === 'testimonial-editor' ? 'block' : 'none'

  if (view !== 'editor') {
    stopAutoSave()
  }
  if (view !== 'testimonial-editor') {
    stopTestimonialAutoSave()
  }
}

// ===== Posts List =====
async function loadPostsList() {
  const tbody = document.getElementById('posts-tbody')
  const noPostsMsg = document.getElementById('no-posts-admin')
  tbody.textContent = ''

  try {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'))
    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      noPostsMsg.style.display = 'block'
      return
    }
    noPostsMsg.style.display = 'none'

    snapshot.forEach(docSnap => {
      const post = docSnap.data()
      const tr = document.createElement('tr')

      // Thumbnail
      const thumbTd = document.createElement('td')
      thumbTd.className = 'thumb-cell'
      if (post.thumbnailUrl) {
        const img = document.createElement('img')
        img.src = post.thumbnailUrl
        img.alt = ''
        thumbTd.appendChild(img)
      } else {
        const placeholder = document.createElement('div')
        placeholder.className = 'thumb-placeholder'
        thumbTd.appendChild(placeholder)
      }
      tr.appendChild(thumbTd)

      // Title
      const titleTd = document.createElement('td')
      titleTd.className = 'post-title-cell'
      titleTd.textContent = post.title || '(無題)'
      titleTd.addEventListener('click', () => openEditor(docSnap.id))
      tr.appendChild(titleTd)

      // Category
      const catTd = document.createElement('td')
      catTd.textContent = post.category || '-'
      tr.appendChild(catTd)

      // Date
      const dateTd = document.createElement('td')
      dateTd.textContent = formatDate(post.createdAt)
      tr.appendChild(dateTd)

      // Status
      const statusTd = document.createElement('td')
      const badge = document.createElement('span')
      badge.className = `status-badge status-${post.status || 'draft'}`
      badge.textContent = post.status === 'published' ? '公開' : '下書き'
      statusTd.appendChild(badge)
      tr.appendChild(statusTd)

      // Actions
      const actionTd = document.createElement('td')
      const editBtn = document.createElement('button')
      editBtn.className = 'btn-edit'
      editBtn.textContent = '編集'
      editBtn.addEventListener('click', () => openEditor(docSnap.id))
      actionTd.appendChild(editBtn)
      tr.appendChild(actionTd)

      tbody.appendChild(tr)
    })
  } catch (err) {
    console.error('記事一覧の取得に失敗:', err)
  }
}

function formatDate(timestamp) {
  if (!timestamp) return '-'
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// ===== Editor =====
document.getElementById('new-post-btn').addEventListener('click', () => openEditor(null))
document.getElementById('back-to-list').addEventListener('click', () => {
  showView('dashboard')
  loadPostsList()
})

async function openEditor(postId) {
  currentPostId = postId
  showView('editor')

  // Initialize Quill if not already
  if (!quillEditor) {
    quillEditor = new Quill('#quill-editor', {
      theme: 'snow',
      placeholder: '記事の本文を書く...',
      modules: {
        toolbar: {
          container: [
            [{ header: [2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ color: [] }, { background: [] }],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['blockquote'],
            ['link', 'image'],
            ['clean']
          ],
          handlers: {
            image: imageHandler
          }
        }
      }
    })
  }

  // Reset form
  document.getElementById('post-title').value = ''
  document.getElementById('post-category').value = ''
  document.getElementById('post-status').value = 'draft'
  document.getElementById('post-excerpt').value = ''
  quillEditor.setContents([])
  resetThumbnailPreview()
  document.getElementById('delete-post-btn').style.display = postId ? 'inline-block' : 'none'

  if (postId) {
    try {
      const docSnap = await getDoc(doc(db, 'posts', postId))
      if (docSnap.exists()) {
        const post = docSnap.data()
        document.getElementById('post-title').value = post.title || ''
        document.getElementById('post-category').value = post.category || ''
        document.getElementById('post-status').value = post.status || 'draft'
        document.getElementById('post-excerpt').value = post.excerpt || ''

        if (post.content) {
          // Quill requires innerHTML for loading rich text content
          // Content is sanitized with DOMPurify before insertion
          const sanitized = DOMPurify.sanitize(post.content)
          quillEditor.root.innerHTML = sanitized // eslint-disable-line no-unsanitized/property
        }

        if (post.thumbnailUrl) {
          showThumbnailPreview(post.thumbnailUrl)
        }
      }
    } catch (err) {
      console.error('記事の読み込みに失敗:', err)
    }
  }

  startAutoSave()
}

// ===== Image Upload (Quill) =====
function imageHandler() {
  const input = document.createElement('input')
  input.setAttribute('type', 'file')
  input.setAttribute('accept', 'image/*')
  input.click()

  input.onchange = async () => {
    const file = input.files[0]
    if (!file) return

    try {
      const resized = await resizeImage(file, 1200)
      const postId = currentPostId || 'temp_' + Date.now()
      const filename = `${Date.now()}_${file.name}`
      const storageRef = ref(storage, `blog-images/${postId}/${filename}`)
      await uploadBytes(storageRef, resized)
      const url = await getDownloadURL(storageRef)

      const range = quillEditor.getSelection(true)
      quillEditor.insertEmbed(range.index, 'image', url)
      quillEditor.setSelection(range.index + 1)
    } catch (err) {
      console.error('画像アップロード失敗:', err)
      alert('画像のアップロードに失敗しました。')
    }
  }
}

// ===== Thumbnail Upload =====
const thumbnailPreview = document.getElementById('thumbnail-preview')
const thumbnailInput = document.getElementById('thumbnail-input')
let currentThumbnailUrl = null

thumbnailPreview.addEventListener('click', () => thumbnailInput.click())

thumbnailInput.addEventListener('change', async (e) => {
  const file = e.target.files[0]
  if (!file) return

  try {
    const resized = await resizeImage(file, 800)
    const postId = currentPostId || 'temp_' + Date.now()
    const filename = `thumb_${Date.now()}_${file.name}`
    const storageRef = ref(storage, `blog-images/${postId}/${filename}`)
    await uploadBytes(storageRef, resized)
    currentThumbnailUrl = await getDownloadURL(storageRef)
    showThumbnailPreview(currentThumbnailUrl)
  } catch (err) {
    console.error('サムネイルアップロード失敗:', err)
    alert('サムネイルのアップロードに失敗しました。')
  }
})

function showThumbnailPreview(url) {
  currentThumbnailUrl = url
  thumbnailPreview.textContent = ''
  const img = document.createElement('img')
  img.src = url
  img.alt = 'サムネイル'
  thumbnailPreview.appendChild(img)
}

function resetThumbnailPreview() {
  currentThumbnailUrl = null
  thumbnailPreview.textContent = ''
  const span = document.createElement('span')
  span.textContent = 'クリックして画像を選択'
  thumbnailPreview.appendChild(span)
  thumbnailInput.value = ''
}

// ===== Image Resize =====
function resizeImage(file, maxWidth) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

// ===== Save =====
document.getElementById('save-post-btn').addEventListener('click', () => savePost(false))

async function savePost(isAutoSave = false) {
  const title = document.getElementById('post-title').value.trim()
  const category = document.getElementById('post-category').value
  const status = document.getElementById('post-status').value
  const excerpt = document.getElementById('post-excerpt').value.trim()
  const content = quillEditor.root.innerHTML

  if (!title && !isAutoSave) {
    alert('タイトルを入力してください。')
    return
  }
  if (!title && isAutoSave) return

  const statusEl = document.getElementById('autosave-status')

  const postData = {
    title,
    category,
    status,
    excerpt,
    content,
    thumbnailUrl: currentThumbnailUrl || null,
    author: auth.currentUser?.email || '',
    updatedAt: serverTimestamp(),
  }

  try {
    if (isAutoSave) {
      statusEl.textContent = '保存中...'
      statusEl.className = 'autosave-status saving'
    }

    if (currentPostId) {
      // Existing post - only set publishedAt if newly published
      if (status === 'published') {
        const existingDoc = await getDoc(doc(db, 'posts', currentPostId))
        if (existingDoc.exists() && !existingDoc.data().publishedAt) {
          postData.publishedAt = serverTimestamp()
        }
      }
      await updateDoc(doc(db, 'posts', currentPostId), postData)
    } else {
      postData.createdAt = serverTimestamp()
      if (status === 'published') {
        postData.publishedAt = serverTimestamp()
      }
      const docRef = await addDoc(collection(db, 'posts'), postData)
      currentPostId = docRef.id
      document.getElementById('delete-post-btn').style.display = 'inline-block'
    }

    if (isAutoSave) {
      statusEl.textContent = '自動保存しました'
      statusEl.className = 'autosave-status saved'
    } else {
      alert('保存しました！')
    }
  } catch (err) {
    console.error('保存に失敗:', err)
    if (!isAutoSave) {
      alert('保存に失敗しました。')
    }
    statusEl.textContent = '保存に失敗'
    statusEl.className = 'autosave-status'
  }
}

// ===== Auto Save =====
function startAutoSave() {
  stopAutoSave()
  autoSaveTimer = setInterval(() => savePost(true), 30000)
}

function stopAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer)
    autoSaveTimer = null
  }
}

// ===== Delete =====
document.getElementById('delete-post-btn').addEventListener('click', async () => {
  if (!currentPostId) return
  if (!confirm('この記事を削除しますか？この操作は取り消せません。')) return

  try {
    await deleteDoc(doc(db, 'posts', currentPostId))
    alert('記事を削除しました。')
    showView('dashboard')
    loadPostsList()
  } catch (err) {
    console.error('削除に失敗:', err)
    alert('削除に失敗しました。')
  }
})

// ===== Admin Tabs =====
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'))
    document.querySelectorAll('.admin-tab-content').forEach(c => {
      c.classList.remove('active')
      c.style.display = 'none'
    })
    tab.classList.add('active')
    const target = document.getElementById(`tab-${tab.dataset.tab}`)
    target.classList.add('active')
    target.style.display = 'block'
  })
})

// ===== Testimonials List =====
async function loadTestimonialsList() {
  const tbody = document.getElementById('testimonials-tbody')
  const noMsg = document.getElementById('no-testimonials-admin')
  tbody.textContent = ''

  try {
    const q = query(collection(db, 'testimonials'), orderBy('createdAt', 'desc'))
    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      noMsg.style.display = 'block'
      return
    }
    noMsg.style.display = 'none'

    snapshot.forEach(docSnap => {
      const item = docSnap.data()
      const tr = document.createElement('tr')

      // Thumbnail
      const thumbTd = document.createElement('td')
      thumbTd.className = 'thumb-cell'
      if (item.thumbnailUrl) {
        const img = document.createElement('img')
        img.src = item.thumbnailUrl
        img.alt = ''
        thumbTd.appendChild(img)
      } else {
        const placeholder = document.createElement('div')
        placeholder.className = 'thumb-placeholder'
        thumbTd.appendChild(placeholder)
      }
      tr.appendChild(thumbTd)

      // Attributes
      const attrTd = document.createElement('td')
      attrTd.className = 'post-title-cell'
      attrTd.textContent = [item.gender, item.age, item.region].filter(Boolean).join(' / ') || '-'
      attrTd.addEventListener('click', () => openTestimonialEditor(docSnap.id))
      tr.appendChild(attrTd)

      // Name
      const nameTd = document.createElement('td')
      nameTd.textContent = item.name || '-'
      tr.appendChild(nameTd)

      // Date
      const dateTd = document.createElement('td')
      dateTd.textContent = formatDate(item.createdAt)
      tr.appendChild(dateTd)

      // Status
      const statusTd = document.createElement('td')
      const badge = document.createElement('span')
      badge.className = `status-badge status-${item.status || 'draft'}`
      badge.textContent = item.status === 'published' ? '公開' : '下書き'
      statusTd.appendChild(badge)
      tr.appendChild(statusTd)

      // Actions
      const actionTd = document.createElement('td')
      const editBtn = document.createElement('button')
      editBtn.className = 'btn-edit'
      editBtn.textContent = '編集'
      editBtn.addEventListener('click', () => openTestimonialEditor(docSnap.id))
      actionTd.appendChild(editBtn)
      tr.appendChild(actionTd)

      tbody.appendChild(tr)
    })
  } catch (err) {
    console.error('お客様の声一覧の取得に失敗:', err)
  }
}

// ===== Testimonial Editor =====
document.getElementById('new-testimonial-btn').addEventListener('click', () => openTestimonialEditor(null))
document.getElementById('back-to-testimonials-list').addEventListener('click', () => {
  showView('dashboard')
  loadTestimonialsList()
})

const testimonialThumbPreview = document.getElementById('testimonial-thumbnail-preview')
const testimonialThumbInput = document.getElementById('testimonial-thumbnail-input')

testimonialThumbPreview.addEventListener('click', () => testimonialThumbInput.click())

testimonialThumbInput.addEventListener('change', async (e) => {
  const file = e.target.files[0]
  if (!file) return

  try {
    const resized = await resizeImage(file, 800)
    const id = currentTestimonialId || 'temp_' + Date.now()
    const filename = `thumb_${Date.now()}_${file.name}`
    const storageRef = ref(storage, `testimonial-images/${id}/${filename}`)
    await uploadBytes(storageRef, resized)
    currentTestimonialThumbnailUrl = await getDownloadURL(storageRef)
    showTestimonialThumbnailPreview(currentTestimonialThumbnailUrl)
  } catch (err) {
    console.error('画像アップロード失敗:', err)
    alert('画像のアップロードに失敗しました。')
  }
})

function showTestimonialThumbnailPreview(url) {
  currentTestimonialThumbnailUrl = url
  testimonialThumbPreview.textContent = ''
  const img = document.createElement('img')
  img.src = url
  img.alt = '写真'
  testimonialThumbPreview.appendChild(img)
}

function resetTestimonialThumbnailPreview() {
  currentTestimonialThumbnailUrl = null
  testimonialThumbPreview.textContent = ''
  const span = document.createElement('span')
  span.textContent = 'クリックして画像を選択'
  testimonialThumbPreview.appendChild(span)
  testimonialThumbInput.value = ''
}

async function openTestimonialEditor(testimonialId) {
  currentTestimonialId = testimonialId
  showView('testimonial-editor')

  // Reset form
  document.getElementById('testimonial-gender').value = ''
  document.getElementById('testimonial-age').value = ''
  document.getElementById('testimonial-region').value = ''
  document.getElementById('testimonial-name').value = ''
  document.getElementById('testimonial-organization').value = ''
  document.getElementById('testimonial-status').value = 'draft'
  document.getElementById('testimonial-content').value = ''
  resetTestimonialThumbnailPreview()
  document.getElementById('delete-testimonial-btn').style.display = testimonialId ? 'inline-block' : 'none'

  if (testimonialId) {
    try {
      const docSnap = await getDoc(doc(db, 'testimonials', testimonialId))
      if (docSnap.exists()) {
        const item = docSnap.data()
        document.getElementById('testimonial-gender').value = item.gender || ''
        document.getElementById('testimonial-age').value = item.age || ''
        document.getElementById('testimonial-region').value = item.region || ''
        document.getElementById('testimonial-name').value = item.name || ''
        document.getElementById('testimonial-organization').value = item.organization || ''
        document.getElementById('testimonial-status').value = item.status || 'draft'
        document.getElementById('testimonial-content').value = item.content || ''

        if (item.thumbnailUrl) {
          showTestimonialThumbnailPreview(item.thumbnailUrl)
        }
      }
    } catch (err) {
      console.error('お客様の声の読み込みに失敗:', err)
    }
  }

  startTestimonialAutoSave()
}

// ===== Testimonial Save =====
document.getElementById('save-testimonial-btn').addEventListener('click', () => saveTestimonial(false))

async function saveTestimonial(isAutoSave = false) {
  const gender = document.getElementById('testimonial-gender').value
  const age = document.getElementById('testimonial-age').value
  const region = document.getElementById('testimonial-region').value.trim()
  const name = document.getElementById('testimonial-name').value.trim()
  const organization = document.getElementById('testimonial-organization').value.trim()
  const status = document.getElementById('testimonial-status').value
  const content = document.getElementById('testimonial-content').value.trim()

  if (!isAutoSave && (!gender || !age || !region)) {
    alert('性別・年齢・地域は必須です。')
    return
  }
  if (!isAutoSave && !content) {
    alert('お客様の声を入力してください。')
    return
  }
  if (isAutoSave && !content) return

  const statusEl = document.getElementById('testimonial-autosave-status')

  const data = {
    gender,
    age,
    region,
    name,
    organization,
    status,
    content,
    thumbnailUrl: currentTestimonialThumbnailUrl || null,
    author: auth.currentUser?.email || '',
    updatedAt: serverTimestamp(),
  }

  try {
    if (isAutoSave) {
      statusEl.textContent = '保存中...'
      statusEl.className = 'autosave-status saving'
    }

    if (currentTestimonialId) {
      if (status === 'published') {
        const existingDoc = await getDoc(doc(db, 'testimonials', currentTestimonialId))
        if (existingDoc.exists() && !existingDoc.data().publishedAt) {
          data.publishedAt = serverTimestamp()
        }
      }
      await updateDoc(doc(db, 'testimonials', currentTestimonialId), data)
    } else {
      data.createdAt = serverTimestamp()
      if (status === 'published') {
        data.publishedAt = serverTimestamp()
      }
      const docRef = await addDoc(collection(db, 'testimonials'), data)
      currentTestimonialId = docRef.id
      document.getElementById('delete-testimonial-btn').style.display = 'inline-block'
    }

    if (isAutoSave) {
      statusEl.textContent = '自動保存しました'
      statusEl.className = 'autosave-status saved'
    } else {
      alert('保存しました！')
    }
  } catch (err) {
    console.error('保存に失敗:', err)
    if (!isAutoSave) {
      alert('保存に失敗しました。')
    }
    statusEl.textContent = '保存に失敗'
    statusEl.className = 'autosave-status'
  }
}

// ===== Testimonial Auto Save =====
function startTestimonialAutoSave() {
  stopTestimonialAutoSave()
  testimonialAutoSaveTimer = setInterval(() => saveTestimonial(true), 30000)
}

function stopTestimonialAutoSave() {
  if (testimonialAutoSaveTimer) {
    clearInterval(testimonialAutoSaveTimer)
    testimonialAutoSaveTimer = null
  }
}

// ===== Testimonial Delete =====
document.getElementById('delete-testimonial-btn').addEventListener('click', async () => {
  if (!currentTestimonialId) return
  if (!confirm('このお客様の声を削除しますか？この操作は取り消せません。')) return

  try {
    await deleteDoc(doc(db, 'testimonials', currentTestimonialId))
    alert('お客様の声を削除しました。')
    showView('dashboard')
    loadTestimonialsList()
  } catch (err) {
    console.error('削除に失敗:', err)
    alert('削除に失敗しました。')
  }
})
