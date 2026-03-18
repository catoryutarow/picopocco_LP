import { db } from './firebase-config.js'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'

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

async function loadNews() {
  const container = document.getElementById('news-container')
  if (!container) return

  try {
    const q = query(
      collection(db, 'posts'),
      where('status', '==', 'published'),
      orderBy('publishedAt', 'desc'),
      limit(4)
    )
    const snapshot = await getDocs(q)

    if (snapshot.empty) return

    container.textContent = ''
    snapshot.forEach(docSnap => {
      const post = docSnap.data()
      const li = document.createElement('li')

      const dateSpan = document.createElement('span')
      dateSpan.className = 'news-date'
      dateSpan.textContent = formatDate(post.publishedAt)
      li.appendChild(dateSpan)

      const catSpan = document.createElement('span')
      catSpan.className = `news-category ${categoryColors[post.category] || 'category-info'}`
      catSpan.textContent = post.category || 'お知らせ'
      li.appendChild(catSpan)

      const titleLink = document.createElement('a')
      titleLink.href = `post.html?id=${encodeURIComponent(docSnap.id)}`
      titleLink.className = 'news-title'
      titleLink.textContent = post.title
      li.appendChild(titleLink)

      container.appendChild(li)
    })
  } catch (err) {
    console.error('ニュースの取得に失敗しました:', err)
  }
}

document.addEventListener('DOMContentLoaded', loadNews)
