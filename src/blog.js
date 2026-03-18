import { db } from './firebase-config.js'
import {
  collection, query, where, orderBy, limit, startAfter,
  getDocs
} from 'firebase/firestore'

const POSTS_PER_PAGE = 6
let lastDoc = null
let currentCategory = null
let isLoading = false

const categoryColors = {
  'イベント': 'category-event',
  '動画': 'category-video',
  'お知らせ': 'category-info',
  '日記': 'category-diary',
  'グッズ': 'category-goods',
}

function formatDate(timestamp) {
  if (!timestamp) return ''
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function createPostCard(post) {
  const card = document.createElement('article')
  card.className = 'blog-card'

  const thumbLink = document.createElement('a')
  thumbLink.href = `post.html?id=${encodeURIComponent(post.id)}`
  thumbLink.className = 'blog-thumbnail-link'
  const thumbDiv = document.createElement('div')
  thumbDiv.className = 'blog-thumbnail'
  if (post.thumbnailUrl) {
    const img = document.createElement('img')
    img.src = post.thumbnailUrl
    img.alt = post.title
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;'
    thumbDiv.appendChild(img)
  } else {
    thumbDiv.textContent = 'サムネイル'
  }
  thumbLink.appendChild(thumbDiv)
  card.appendChild(thumbLink)

  const content = document.createElement('div')
  content.className = 'blog-content'

  const meta = document.createElement('div')
  meta.className = 'blog-meta'
  const dateSpan = document.createElement('span')
  dateSpan.className = 'blog-date'
  dateSpan.textContent = formatDate(post.publishedAt)
  meta.appendChild(dateSpan)
  if (post.category) {
    const catSpan = document.createElement('span')
    catSpan.className = `news-category ${categoryColors[post.category] || 'category-info'}`
    catSpan.textContent = post.category
    meta.appendChild(catSpan)
  }
  content.appendChild(meta)

  const titleH3 = document.createElement('h3')
  titleH3.className = 'blog-title'
  const titleLink = document.createElement('a')
  titleLink.href = `post.html?id=${encodeURIComponent(post.id)}`
  titleLink.textContent = post.title
  titleH3.appendChild(titleLink)
  content.appendChild(titleH3)

  const excerpt = document.createElement('p')
  excerpt.className = 'blog-excerpt'
  excerpt.textContent = post.excerpt || ''
  content.appendChild(excerpt)

  const readMore = document.createElement('a')
  readMore.href = `post.html?id=${encodeURIComponent(post.id)}`
  readMore.className = 'read-more'
  readMore.textContent = 'もっと読む'
  content.appendChild(readMore)

  card.appendChild(content)
  return card
}

function showSkeleton(container) {
  container.textContent = ''
  for (let i = 0; i < 3; i++) {
    const skeleton = document.createElement('div')
    skeleton.className = 'blog-card skeleton-card'

    const thumbSkel = document.createElement('div')
    thumbSkel.className = 'blog-thumbnail skeleton-pulse'
    skeleton.appendChild(thumbSkel)

    const contentSkel = document.createElement('div')
    contentSkel.className = 'blog-content'
    const lines = [
      { width: '30%', height: '14px', mb: '10px' },
      { width: '80%', height: '20px', mb: '10px' },
      { width: '100%', height: '14px', mb: '6px' },
      { width: '60%', height: '14px', mb: '0' },
    ]
    lines.forEach(l => {
      const line = document.createElement('div')
      line.className = 'skeleton-line skeleton-pulse'
      line.style.cssText = `width:${l.width};height:${l.height};margin-bottom:${l.mb};`
      contentSkel.appendChild(line)
    })
    skeleton.appendChild(contentSkel)
    container.appendChild(skeleton)
  }
}

async function loadPosts(reset = false) {
  if (isLoading) return
  isLoading = true

  const blogGrid = document.getElementById('blog-container')
  const loadMoreBtn = document.getElementById('load-more-btn')
  const noPostsMsg = document.getElementById('no-posts-msg')

  if (reset) {
    lastDoc = null
    showSkeleton(blogGrid)
  }

  try {
    const constraints = [
      where('status', '==', 'published'),
    ]
    if (currentCategory) {
      constraints.push(where('category', '==', currentCategory))
    }
    constraints.push(orderBy('publishedAt', 'desc'))
    constraints.push(limit(POSTS_PER_PAGE))
    if (lastDoc) {
      constraints.push(startAfter(lastDoc))
    }

    const q = query(collection(db, 'posts'), ...constraints)
    const snapshot = await getDocs(q)

    if (reset) {
      blogGrid.textContent = ''
    }

    if (snapshot.empty && !lastDoc) {
      noPostsMsg.style.display = 'block'
      loadMoreBtn.style.display = 'none'
    } else {
      noPostsMsg.style.display = 'none'
      snapshot.forEach(doc => {
        blogGrid.appendChild(createPostCard({ id: doc.id, ...doc.data() }))
      })
      lastDoc = snapshot.docs[snapshot.docs.length - 1]
      loadMoreBtn.style.display = snapshot.size < POSTS_PER_PAGE ? 'none' : 'inline-block'
    }
  } catch (err) {
    console.error('記事の取得に失敗しました:', err)
    const errorMsg = document.createElement('p')
    errorMsg.style.cssText = 'text-align:center;color:#888;'
    errorMsg.textContent = '記事の読み込みに失敗しました。再度お試しください。'
    blogGrid.textContent = ''
    blogGrid.appendChild(errorMsg)
  } finally {
    isLoading = false
  }
}

async function loadCategories() {
  const container = document.getElementById('category-filter')
  if (!container) return

  try {
    const snapshot = await getDocs(
      query(collection(db, 'categories'), orderBy('order'))
    )

    const allBtn = document.createElement('button')
    allBtn.className = 'filter-btn active'
    allBtn.textContent = 'すべて'
    allBtn.addEventListener('click', () => {
      currentCategory = null
      setActiveFilter(allBtn)
      loadPosts(true)
    })
    container.appendChild(allBtn)

    snapshot.forEach(doc => {
      const cat = doc.data()
      const btn = document.createElement('button')
      btn.className = 'filter-btn'
      btn.textContent = cat.name
      btn.addEventListener('click', () => {
        currentCategory = cat.name
        setActiveFilter(btn)
        loadPosts(true)
      })
      container.appendChild(btn)
    })
  } catch (err) {
    console.error('カテゴリの取得に失敗しました:', err)
  }
}

function setActiveFilter(activeBtn) {
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'))
  activeBtn.classList.add('active')
}

document.addEventListener('DOMContentLoaded', () => {
  loadCategories()
  loadPosts(true)

  const loadMoreBtn = document.getElementById('load-more-btn')
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => loadPosts(false))
  }
})
