// Loading Overlay
;(() => {
  let dismissed = false

  function dismissLoading() {
    if (dismissed) return
    dismissed = true
    const overlay = document.getElementById('loading-overlay')
    if (overlay) {
      overlay.classList.add('fade-out')
      document.body.classList.remove('is-loading')
      overlay.addEventListener('transitionend', () => overlay.remove())
    }
  }

  // Wait for images + videos, then dismiss
  document.addEventListener('DOMContentLoaded', () => {
    const promises = []

    // Images
    Array.from(document.images).forEach(img => {
      if (!img.complete) {
        promises.push(new Promise(r => {
          img.addEventListener('load', r)
          img.addEventListener('error', r)
        }))
      }
    })

    // Videos — wait for enough data to start playback
    document.querySelectorAll('video').forEach(video => {
      if (video.readyState < 3) {
        promises.push(new Promise(r => {
          video.addEventListener('canplay', r, { once: true })
          video.addEventListener('error', r, { once: true })
        }))
      }
    })

    if (promises.length === 0) {
      dismissLoading()
    } else {
      Promise.all(promises).then(dismissLoading)
    }
  })

  // Fallback: dismiss after 15 seconds no matter what
  setTimeout(dismissLoading, 15000)
})()

// Mobile Menu Toggle
document.addEventListener('DOMContentLoaded', () => {
  // Desktop hamburger
  const menuToggle = document.querySelector('.menu-toggle');
  const mainNav = document.querySelector('.main-nav');

  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      mainNav.classList.toggle('active');
    });
  }

  // Mobile fixed menu button
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const mobileNav = document.querySelector('.mobile-nav');
  if (mobileMenuBtn && mobileNav) {
    mobileMenuBtn.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('active');
      mobileMenuBtn.textContent = isOpen ? 'とじる' : 'メニュー';
    });

    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('active');
        mobileMenuBtn.textContent = 'メニュー';
      });
    });
  }

  // Carousel Logic
  const carousel = document.querySelector('.carousel');
  const track = document.querySelector('.carousel-track');
  const slides = track ? Array.from(track.children) : [];
  const dotsContainer = document.querySelector('.carousel-dots');
  const prevBtn = document.querySelector('.carousel-arrow--prev');
  const nextBtn = document.querySelector('.carousel-arrow--next');

  if (slides.length > 0) {
    let currentIndex = 0;
    const slideInterval = 7000;

    // Generate dots
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.classList.add('carousel-dot');
      if (i === 0) dot.classList.add('active');
      dot.setAttribute('aria-label', `スライド ${i + 1}`);
      dot.addEventListener('click', () => {
        goToSlide(i);
        resetAutoPlay();
      });
      dotsContainer.appendChild(dot);
    });

    const dots = Array.from(dotsContainer.children);

    const updateDots = (index) => {
      dots.forEach((d, i) => d.classList.toggle('active', i === index));
    };

    const goToSlide = (index) => {
      track.style.transform = `translateX(${-100 * index}%)`;
      currentIndex = index;
      updateDots(index);
    };

    const nextSlide = () => goToSlide((currentIndex + 1) % slides.length);
    const prevSlide = () => goToSlide((currentIndex - 1 + slides.length) % slides.length);

    // Arrow buttons
    nextBtn.addEventListener('click', () => { nextSlide(); resetAutoPlay(); });
    prevBtn.addEventListener('click', () => { prevSlide(); resetAutoPlay(); });

    // Auto-play
    let autoPlay = setInterval(nextSlide, slideInterval);

    const resetAutoPlay = () => {
      clearInterval(autoPlay);
      autoPlay = setInterval(nextSlide, slideInterval);
    };

    carousel.addEventListener('mouseenter', () => clearInterval(autoPlay));
    carousel.addEventListener('mouseleave', () => {
      autoPlay = setInterval(nextSlide, slideInterval);
    });

    // Touch / swipe support
    let touchStartX = 0;
    let touchEndX = 0;

    carousel.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    carousel.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 40) {
        if (diff > 0) nextSlide();
        else prevSlide();
        resetAutoPlay();
      }
    }, { passive: true });
  }

  // PC: Custom scroll resistance at edges
  if (window.matchMedia('(min-width: 769px)').matches) {
    const edgeZone = 400; // px from top/bottom where resistance kicks in
    let scrollTarget = window.scrollY;
    let isAnimating = false;

    const getMaxScroll = () => document.documentElement.scrollHeight - window.innerHeight;

    const applyResistance = (delta) => {
      const scrollY = scrollTarget;
      const maxScroll = getMaxScroll();
      let factor = 1;

      if (delta < 0 && scrollY < edgeZone) {
        // Near top, scrolling up
        factor = Math.max(0.05, scrollY / edgeZone);
      } else if (delta > 0 && scrollY > maxScroll - edgeZone) {
        // Near bottom, scrolling down
        const distFromBottom = maxScroll - scrollY;
        factor = Math.max(0.05, distFromBottom / edgeZone);
      }

      return delta * factor;
    };

    const smoothScroll = () => {
      const current = window.scrollY;
      const diff = scrollTarget - current;

      if (Math.abs(diff) < 0.5) {
        window.scrollTo(0, scrollTarget);
        isAnimating = false;
        return;
      }

      window.scrollTo(0, current + diff * 0.15);
      requestAnimationFrame(smoothScroll);
    };

    window.addEventListener('wheel', (e) => {
      e.preventDefault();

      const resistedDelta = applyResistance(e.deltaY);
      scrollTarget = Math.max(0, Math.min(getMaxScroll(), scrollTarget + resistedDelta));

      if (!isAnimating) {
        isAnimating = true;
        requestAnimationFrame(smoothScroll);
      }
    }, { passive: false });

    // Sync scrollTarget when anchor links are clicked or other scroll happens
    window.addEventListener('scroll', () => {
      if (!isAnimating) {
        scrollTarget = window.scrollY;
      }
    }, { passive: true });

    // Handle scroll-to-top button
    window.addEventListener('scrollToTop', () => {
      scrollTarget = 0;
      if (!isAnimating) {
        isAnimating = true;
        requestAnimationFrame(smoothScroll);
      }
    });

    // Handle anchor link clicks with smooth scroll + sync
    document.querySelectorAll('a[href*="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        const hashIndex = href.indexOf('#');
        if (hashIndex === -1) return;
        const hash = href.substring(hashIndex);
        const target = document.querySelector(hash);
        if (!target) return;

        e.preventDefault();
        const targetY = Math.min(target.getBoundingClientRect().top + window.scrollY, getMaxScroll());
        scrollTarget = targetY;

        if (!isAnimating) {
          isAnimating = true;
          requestAnimationFrame(smoothScroll);
        }
      });
    });
  }

  // Scroll to Top
  const scrollTopBtn = document.getElementById('scrollTop');
  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', () => {
      if (window.matchMedia('(min-width: 769px)').matches) {
        // Use custom scroll system
        const evt = new Event('scrollToTop');
        window.dispatchEvent(evt);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }
});
