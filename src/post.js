import { db } from './firebase-config.js'
import { doc, getDoc } from 'firebase/firestore'
import DOMPurify from 'dompurify'

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

function showMessage(container, loadingEl, text) {
  loadingEl.style.display = 'none'
  const msg = document.createElement('p')
  msg.style.cssText = 'text-align:center;color:#888;'
  msg.textContent = text
  container.appendChild(msg)
}

async function loadPost() {
  const params = new URLSearchParams(window.location.search)
  const postId = params.get('id')

  const container = document.getElementById('post-container')
  const loadingEl = document.getElementById('post-loading')

  if (!postId) {
    showMessage(container, loadingEl, '記事が見つかりませんでした。')
    return
  }

  try {
    const docSnap = await getDoc(doc(db, 'posts', postId))

    if (!docSnap.exists()) {
      showMessage(container, loadingEl, '記事が見つかりませんでした。')
      return
    }

    const post = docSnap.data()

    if (post.status !== 'published') {
      showMessage(container, loadingEl, 'この記事は公開されていません。')
      return
    }

    document.title = `${post.title} | ピコポッコ Official Website`
    loadingEl.style.display = 'none'

    // Build article DOM safely
    const article = document.createElement('article')
    article.className = 'post-detail'

    // Header
    const header = document.createElement('div')
    header.className = 'post-header'

    const meta = document.createElement('div')
    meta.className = 'post-meta'
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
    header.appendChild(meta)

    const title = document.createElement('h1')
    title.className = 'post-title'
    title.textContent = post.title
    header.appendChild(title)

    if (post.author) {
      const author = document.createElement('span')
      author.className = 'post-author'
      author.textContent = `by ${post.author}`
      header.appendChild(author)
    }
    article.appendChild(header)

    // Thumbnail
    if (post.thumbnailUrl) {
      const thumbDiv = document.createElement('div')
      thumbDiv.className = 'post-thumbnail'
      const img = document.createElement('img')
      img.src = post.thumbnailUrl
      img.alt = post.title
      thumbDiv.appendChild(img)
      article.appendChild(thumbDiv)
    }

    // Body - sanitized HTML from Quill editor
    const body = document.createElement('div')
    body.className = 'post-body'
    body.innerHTML = DOMPurify.sanitize(post.content || '')
    article.appendChild(body)

    // Footer
    const footer = document.createElement('div')
    footer.className = 'post-footer'
    const backLink = document.createElement('a')
    backLink.href = 'blog.html'
    backLink.className = 'btn btn-primary'
    backLink.textContent = '← ブログ一覧へ戻る'
    footer.appendChild(backLink)
    article.appendChild(footer)

    container.appendChild(article)
  } catch (err) {
    console.error('記事の取得に失敗しました:', err)
    showMessage(container, loadingEl, '記事の読み込みに失敗しました。')
  }
}

document.addEventListener('DOMContentLoaded', loadPost)
