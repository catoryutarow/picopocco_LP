import { db } from './firebase-config.js'
import {
  collection, query, where, orderBy, limit, startAfter,
  getDocs
} from 'firebase/firestore'

const ITEMS_PER_PAGE = 6
let lastDoc = null
let isLoading = false

function formatDate(timestamp) {
  if (!timestamp) return ''
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function createTestimonialCard(item) {
  const card = document.createElement('article')
  card.className = 'testimonial-card'

  if (item.thumbnailUrl) {
    const imgWrap = document.createElement('div')
    imgWrap.className = 'testimonial-image'
    const img = document.createElement('img')
    img.src = item.thumbnailUrl
    img.alt = item.name || ''
    imgWrap.appendChild(img)
    card.appendChild(imgWrap)
  }

  const body = document.createElement('div')
  body.className = 'testimonial-body'

  const quote = document.createElement('p')
  quote.className = 'testimonial-quote'
  quote.textContent = item.content || ''
  body.appendChild(quote)

  const footer = document.createElement('div')
  footer.className = 'testimonial-footer'

  const nameEl = document.createElement('span')
  nameEl.className = 'testimonial-name'
  nameEl.textContent = item.name || ''
  footer.appendChild(nameEl)

  if (item.organization) {
    const orgEl = document.createElement('span')
    orgEl.className = 'testimonial-org'
    orgEl.textContent = item.organization
    footer.appendChild(orgEl)
  }

  const dateEl = document.createElement('span')
  dateEl.className = 'testimonial-date'
  dateEl.textContent = formatDate(item.publishedAt)
  footer.appendChild(dateEl)

  body.appendChild(footer)
  card.appendChild(body)

  return card
}

function showSkeleton(container) {
  container.textContent = ''
  for (let i = 0; i < 3; i++) {
    const skeleton = document.createElement('div')
    skeleton.className = 'testimonial-card skeleton-card'

    const bodySkel = document.createElement('div')
    bodySkel.className = 'testimonial-body'
    const lines = [
      { width: '100%', height: '16px', mb: '8px' },
      { width: '90%', height: '16px', mb: '8px' },
      { width: '70%', height: '16px', mb: '20px' },
      { width: '40%', height: '14px', mb: '0' },
    ]
    lines.forEach(l => {
      const line = document.createElement('div')
      line.className = 'skeleton-line skeleton-pulse'
      line.style.cssText = `width:${l.width};height:${l.height};margin-bottom:${l.mb};`
      bodySkel.appendChild(line)
    })
    skeleton.appendChild(bodySkel)
    container.appendChild(skeleton)
  }
}

async function loadTestimonials(reset = false) {
  if (isLoading) return
  isLoading = true

  const grid = document.getElementById('testimonials-container')
  const loadMoreBtn = document.getElementById('load-more-btn')
  const noMsg = document.getElementById('no-testimonials-msg')

  if (reset) {
    lastDoc = null
    showSkeleton(grid)
  }

  try {
    const constraints = [
      where('status', '==', 'published'),
      orderBy('publishedAt', 'desc'),
      limit(ITEMS_PER_PAGE),
    ]
    if (lastDoc) {
      constraints.push(startAfter(lastDoc))
    }

    const q = query(collection(db, 'testimonials'), ...constraints)
    const snapshot = await getDocs(q)

    if (reset) {
      grid.textContent = ''
    }

    if (snapshot.empty && !lastDoc) {
      noMsg.style.display = 'block'
      loadMoreBtn.style.display = 'none'
    } else {
      noMsg.style.display = 'none'
      snapshot.forEach(doc => {
        grid.appendChild(createTestimonialCard({ id: doc.id, ...doc.data() }))
      })
      lastDoc = snapshot.docs[snapshot.docs.length - 1]
      loadMoreBtn.style.display = snapshot.size < ITEMS_PER_PAGE ? 'none' : 'inline-block'
    }
  } catch (err) {
    console.error('お客様の声の取得に失敗しました:', err)
    const errorMsg = document.createElement('p')
    errorMsg.style.cssText = 'text-align:center;color:#888;'
    errorMsg.textContent = 'お客様の声の読み込みに失敗しました。再度お試しください。'
    grid.textContent = ''
    grid.appendChild(errorMsg)
  } finally {
    isLoading = false
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadTestimonials(true)

  const loadMoreBtn = document.getElementById('load-more-btn')
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => loadTestimonials(false))
  }
})
