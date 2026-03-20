import { db } from './firebase-config.js'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'

function formatDate(timestamp) {
  if (!timestamp) return ''
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

async function loadTestimonialsHome() {
  const container = document.getElementById('testimonials-home-container')
  if (!container) return

  try {
    const q = query(
      collection(db, 'testimonials'),
      where('status', '==', 'published'),
      orderBy('publishedAt', 'desc'),
      limit(3)
    )
    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      container.closest('.section-testimonials')?.remove()
      return
    }

    container.textContent = ''
    snapshot.forEach(docSnap => {
      const item = docSnap.data()

      const card = document.createElement('div')
      card.className = 'testimonial-card-home'

      if (item.thumbnailUrl) {
        const imgWrap = document.createElement('div')
        imgWrap.className = 'testimonial-card-home__image'
        const img = document.createElement('img')
        img.src = item.thumbnailUrl
        img.alt = ''
        imgWrap.appendChild(img)
        card.appendChild(imgWrap)
      }

      const quote = document.createElement('p')
      quote.className = 'testimonial-card-home__quote'
      quote.textContent = item.content || ''
      card.appendChild(quote)

      const footer = document.createElement('div')
      footer.className = 'testimonial-card-home__footer'

      // Attribute line: gender / age / region
      const attrEl = document.createElement('span')
      attrEl.className = 'testimonial-card-home__attr'
      attrEl.textContent = [item.gender, item.age, item.region].filter(Boolean).join(' / ')
      footer.appendChild(attrEl)

      // Optional name
      if (item.name) {
        const nameEl = document.createElement('span')
        nameEl.className = 'testimonial-card-home__name'
        nameEl.textContent = item.name
        footer.appendChild(nameEl)
      }

      // Optional organization
      if (item.organization) {
        const orgEl = document.createElement('span')
        orgEl.className = 'testimonial-card-home__org'
        orgEl.textContent = item.organization
        footer.appendChild(orgEl)
      }

      card.appendChild(footer)
      container.appendChild(card)
    })
  } catch (err) {
    console.error('お客様の声の取得に失敗しました:', err)
  }
}

document.addEventListener('DOMContentLoaded', loadTestimonialsHome)
