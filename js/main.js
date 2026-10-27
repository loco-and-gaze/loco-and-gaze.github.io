function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('scroll', function () {
  const button = document.querySelector('.scroll-to-top');
  if (button) {
    button.classList.toggle('visible', window.scrollY > 300);
  }
});

let copyFeedbackTimer;

function copyFallback(text) {
  const input = document.createElement('textarea');
  input.value = text;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  return copied;
}

async function copyBibTeX() {
  const code = document.getElementById('bibtex-code');
  const button = document.querySelector('.copy-bibtex-btn');
  if (!code || !button) return;

  const label = button.querySelector('.copy-text');
  let copied = false;

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(code.textContent);
      copied = true;
    } catch (_) {
      copied = copyFallback(code.textContent);
    }
  } else {
    copied = copyFallback(code.textContent);
  }

  if (!copied || !label) return;
  button.classList.add('copied');
  label.textContent = 'Cop';
  window.clearTimeout(copyFeedbackTimer);
  copyFeedbackTimer = window.setTimeout(function () {
    button.classList.remove('copied');
    label.textContent = 'Copy';
  }, 2000);
}

const methodImage = document.querySelector('.method-figure img');
if (methodImage) {
  methodImage.addEventListener('click', function () {
    const overlay = document.createElement('div');
    overlay.className = 'img-lightbox-overlay';

    const image = document.createElement('img');
    image.src = this.src;
    image.alt = this.alt;
    overlay.appendChild(image);
    document.body.appendChild(overlay);

    const openingFrame = requestAnimationFrame(function () {
      overlay.classList.add('active');
    });
    overlay.addEventListener('click', function () {
      cancelAnimationFrame(openingFrame);
      overlay.classList.remove('active');
      overlay.addEventListener('transitionend', function () {
        overlay.remove();
      }, { once: true });
      window.setTimeout(function () { overlay.remove(); }, 350);
    }, { once: true });
  });
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const reviewVideos = Array.from(document.querySelectorAll('.review-media'));
const previewVideo = document.querySelector('.preview-videos video');
const visibleVideos = new Set();
const nearbyVideos = new Set();
const loadingVideos = new Set();
const loadedVideos = new Set();
const failedVideos = new Set();
const userPausedVideos = new WeakSet();
const programmaticPauses = new WeakSet();
const MAX_CONCURRENT = 2;

function pauseVideo(video) {
  if (video.paused) return;
  programmaticPauses.add(video);
  video.pause();
}

function activeVideo(video) {
  return !video.closest('[inert]');
}

function updatePlayback(video) {
  if (loadedVideos.has(video) && visibleVideos.has(video) && activeVideo(video) &&
      !document.hidden && !reducedMotion.matches && !userPausedVideos.has(video)) {
    video.play().catch(function () {});
  } else {
    pauseVideo(video);
  }
}

function startLoad(video) {
  if (loadingVideos.has(video) || loadedVideos.has(video) || failedVideos.has(video)) return;
  loadingVideos.add(video);
  video.preload = 'auto';
  video.load();
}

function fillSlots() {
  if (previewVideo && !loadedVideos.has(previewVideo) && !failedVideos.has(previewVideo)) {
    startLoad(previewVideo);
    return;
  }
  const candidates = reviewVideos.filter(video => video !== previewVideo);
  const priority = candidates.filter(video => nearbyVideos.has(video) && activeVideo(video));
  const remainder = candidates.filter(video => !priority.includes(video));
  for (const video of priority.concat(remainder)) {
    if (loadingVideos.size >= MAX_CONCURRENT) break;
    startLoad(video);
  }
}

reviewVideos.forEach(function (video) {
  const wrapper = document.createElement('div');
  wrapper.className = 'video-skeleton';
  wrapper.setAttribute('aria-busy', 'true');
  video.parentNode.insertBefore(wrapper, video);
  wrapper.appendChild(video);
  wrapper.style.aspectRatio = `${video.width} / ${video.height}`;
  video.removeAttribute('autoplay');
  video.muted = true;
  video.defaultMuted = true;

  video.addEventListener('canplay', function () {
    if (video.readyState < 3) return;
    loadingVideos.delete(video);
    loadedVideos.add(video);
    failedVideos.delete(video);
    wrapper.classList.remove('failed');
    wrapper.classList.add('loaded');
    wrapper.setAttribute('aria-busy', 'false');
    updatePlayback(video);
    fillSlots();
  });
  function handleLoadError() {
    loadingVideos.delete(video);
    loadedVideos.delete(video);
    failedVideos.add(video);
    wrapper.classList.add('failed');
    wrapper.setAttribute('aria-busy', 'false');
    fillSlots();
  }
  video.addEventListener('error', handleLoadError);
  video.querySelector('source').addEventListener('error', handleLoadError);
  video.addEventListener('loadedmetadata', function () {
    if (video.videoWidth && video.videoHeight) {
      wrapper.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
    }
  });
  video.addEventListener('pause', function () {
    if (!video.paused) return;
    if (programmaticPauses.has(video)) programmaticPauses.delete(video);
    else userPausedVideos.add(video);
  });
  video.addEventListener('play', function () {
    programmaticPauses.delete(video);
    userPausedVideos.delete(video);
  });
});

reducedMotion.addEventListener('change', function () { reviewVideos.forEach(updatePlayback); });
document.addEventListener('visibilitychange', function () {
  if (document.hidden) reviewVideos.forEach(pauseVideo);
  else reviewVideos.forEach(updatePlayback);
});

const loadingObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) nearbyVideos.add(entry.target);
    else nearbyVideos.delete(entry.target);
  });
  fillSlots();
}, { rootMargin: '200px' });

const playbackObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting && entry.intersectionRatio >= 0.5) visibleVideos.add(entry.target);
    else visibleVideos.delete(entry.target);
    updatePlayback(entry.target);
  });
}, { threshold: [0, 0.5] });
reviewVideos.forEach(function (video) {
  loadingObserver.observe(video);
  playbackObserver.observe(video);
});

document.querySelectorAll('[data-carousel]').forEach(function (carousel) {
  const slider = carousel.querySelector('.sim-carousel-slider');
  const slides = Array.from(carousel.querySelectorAll('.sim-carousel-slide'));
  const dots = Array.from(carousel.querySelectorAll('[data-carousel-index]'));
  let index = 0;

  function showSlide(nextIndex) {
    index = (nextIndex + slides.length) % slides.length;
    slider.style.transform = 'translateX(-' + index * 100 + '%)';
    slides.forEach(function (slide, slideIndex) {
      const active = slideIndex === index;
      slide.inert = !active;
      slide.setAttribute('aria-hidden', String(!active));
      if (!active) slide.querySelectorAll('video').forEach(pauseVideo);
    });
    dots.forEach(function (dot, dotIndex) {
      dot.classList.toggle('active', dotIndex === index);
      if (dotIndex === index) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    fillSlots();
  }

  carousel.querySelectorAll('[data-carousel-nav]').forEach(function (button) {
    button.addEventListener('click', function () { showSlide(index + Number(button.dataset.carouselNav)); });
  });
  dots.forEach(function (dot) {
    dot.addEventListener('click', function () { showSlide(Number(dot.dataset.carouselIndex)); });
  });
  showSlide(0);
});
fillSlots();
