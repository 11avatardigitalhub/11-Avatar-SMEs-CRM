/**
 * 11 AVATAR DIGITAL HUB - Carousel Component
 * Enterprise-grade image/content slider component
 * Touch swipe, autoplay, lazy loading, thumbnails, 3D effects, responsive
 * 
 * @component Carousel
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';

class Carousel {
    constructor(container, options = {}) {
        this.componentName = 'Carousel';
        this.componentId = `car-${Date.now().toString(36)}`;
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        if (!this.container) throw new Error('Carousel: Container not found');

        this.config = {
            slides: options.slides || [],
            activeIndex: options.activeIndex || 0,
            autoPlay: options.autoPlay || false,
            autoPlayInterval: options.autoPlayInterval || 5000,
            pauseOnHover: options.pauseOnHover !== false,
            pauseOnFocus: options.pauseOnFocus !== false,
            infinite: options.infinite !== false,
            showArrows: options.showArrows !== false,
            showDots: options.showDots !== false,
            showThumbnails: options.showThumbnails || false,
            thumbnailsPosition: options.thumbnailsPosition || 'bottom',
            slidesToShow: options.slidesToShow || 1,
            slidesToScroll: options.slidesToScroll || 1,
            gap: options.gap || 16,
            transition: options.transition || 'slide',
            transitionDuration: options.transitionDuration || 400,
            easing: options.easing || 'cubic-bezier(0.4, 0, 0.2, 1)',
            swipe: options.swipe !== false,
            swipeThreshold: options.swipeThreshold || 50,
            draggable: options.draggable !== false,
            keyboard: options.keyboard !== false,
            lazyLoad: options.lazyLoad || false,
            lazyLoadOffset: options.lazyLoadOffset || 2,
            preloadImages: options.preloadImages !== false,
            adaptiveHeight: options.adaptiveHeight || false,
            centerMode: options.centerMode || false,
            fadeEffect: options.fadeEffect || false,
            threeDEffect: options.threeDEffect || false,
            theme: options.theme || 'light',
            height: options.height || 400,
            aspectRatio: options.aspectRatio || null,
            onSlideChange: options.onSlideChange || null,
            onInit: options.onInit || null,
            onSwipe: options.onSwipe || null
        };

        this.state = {
            activeIndex: this.config.activeIndex,
            previousIndex: -1,
            slideCount: this.config.slides.length,
            isAnimating: false,
            isAutoPlaying: false,
            isHovered: false,
            isFocused: false,
            touchStartX: 0,
            touchStartY: 0,
            touchDeltaX: 0,
            touchDeltaY: 0,
            isSwiping: false,
            loadedImages: new Set(),
            autoPlayTimer: null,
            animationTimer: null
        };

        this.elements = {
            wrapper: null, track: null, slides: [], prevBtn: null, nextBtn: null,
            dots: [], dotsContainer: null, thumbnails: [], thumbnailsContainer: null
        };

        this.init();
    }

    init() {
        try {
            console.log(`[Carousel] Initializing: ${this.componentId}`);
            if (this.config.slides.length === 0) {
                this.container.innerHTML = '<div class="car-empty">No slides to display</div>';
                return;
            }
            this.render();
            this.bindEvents();
            if (this.config.autoPlay) this.startAutoPlay();
            if (this.config.preloadImages) this.preloadImages();
            if (this.config.onInit) this.config.onInit(this);
            EventBus.emit('carousel:ready', { componentId: this.componentId, slideCount: this.state.slideCount });
        } catch (error) {
            console.error('[Carousel] Init failed:', error);
            this.container.innerHTML = `<div class="car-error">Failed to load carousel: ${this.escapeHtml(error.message)}</div>`;
        }
    }

    render() {
        const themeClass = `car-theme-${this.config.theme}`;
        const fadeClass = this.config.fadeEffect ? 'car-fade' : '';
        const threeDClass = this.config.threeDEffect ? 'car-3d' : '';
        const centerClass = this.config.centerMode ? 'car-center' : '';
        const totalSlides = this.state.slideCount;
        const slidesPerView = this.config.slidesToShow;
        const slideWidth = 100 / slidesPerView;
        const trackOffset = -this.state.activeIndex * slideWidth;

        const html = `
            <div class="car-wrapper ${themeClass} ${fadeClass} ${threeDClass} ${centerClass}" 
                 id="${this.componentId}" role="region" aria-label="Carousel" aria-roledescription="carousel"
                 style="height:${this.config.height}px;${this.config.aspectRatio ? `aspect-ratio:${this.config.aspectRatio};` : ''}">
                
                <div class="car-viewport" id="${this.componentId}-viewport" aria-live="polite">
                    <div class="car-track" id="${this.componentId}-track" 
                         style="transform:translateX(${trackOffset}%);transition:transform ${this.config.transitionDuration}ms ${this.config.easing};gap:${this.config.gap}px;">
                        ${this.config.slides.map((slide, index) => `
                            <div class="car-slide ${index === this.state.activeIndex ? 'active' : ''}" 
                                 id="${this.componentId}-slide-${index}"
                                 role="group" aria-roledescription="slide"
                                 aria-label="Slide ${index + 1} of ${totalSlides}"
                                 aria-hidden="${index !== this.state.activeIndex}"
                                 style="flex:0 0 calc(${slideWidth}% - ${this.config.gap}px);">
                                ${this.renderSlide(slide, index)}
                            </div>
                        `).join('')}
                    </div>
                </div>

                ${this.config.showArrows && totalSlides > 1 ? `
                    <button class="car-arrow car-prev" id="${this.componentId}-prev" aria-label="Previous slide" type="button">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <button class="car-arrow car-next" id="${this.componentId}-next" aria-label="Next slide" type="button">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                ` : ''}

                ${this.config.showDots && totalSlides > 1 ? `
                    <div class="car-dots" id="${this.componentId}-dots" role="tablist" aria-label="Slide navigation">
                        ${this.config.slides.map((_, index) => `
                            <button class="car-dot ${index === this.state.activeIndex ? 'active' : ''}" 
                                    id="${this.componentId}-dot-${index}"
                                    role="tab" aria-selected="${index === this.state.activeIndex}"
                                    aria-label="Go to slide ${index + 1}"
                                    data-index="${index}" type="button"></button>
                        `).join('')}
                    </div>
                ` : ''}

                ${this.config.showThumbnails ? `
                    <div class="car-thumbnails car-thumbs-${this.config.thumbnailsPosition}" id="${this.componentId}-thumbs">
                        ${this.config.slides.map((slide, index) => `
                            <button class="car-thumb ${index === this.state.activeIndex ? 'active' : ''}" 
                                    data-index="${index}" type="button"
                                    aria-label="Go to slide ${index + 1}">
                                ${slide.thumbnail ? `<img src="${slide.thumbnail}" alt="" loading="lazy">` : `<span>${index + 1}</span>`}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>`;

        this.container.innerHTML = html;
        this.cacheElements();
    }

    renderSlide(slide, index) {
        if (slide.type === 'image' || slide.image) {
            const imgSrc = this.config.lazyLoad && index > this.state.activeIndex + this.config.lazyLoadOffset ? 
                (slide.placeholder || '') : (slide.image || slide.src || '');
            return `<img src="${imgSrc}" alt="${this.escapeHtml(slide.alt || slide.title || '')}" 
                         class="car-image" ${this.config.lazyLoad ? `data-src="${slide.image || slide.src}"` : ''} 
                         loading="${index === this.state.activeIndex ? 'eager' : 'lazy'}"
                         draggable="false">`;
        }
        if (slide.type === 'video') {
            return `<video src="${slide.src}" controls class="car-video" preload="metadata" 
                          ${slide.poster ? `poster="${slide.poster}"` : ''}></video>`;
        }
        if (slide.content) return slide.content;
        if (slide.html) return slide.html;
        return `<div class="car-custom-content">${this.escapeHtml(slide.title || `Slide ${index + 1}`)}</div>`;
    }

    cacheElements() {
        this.elements.wrapper = document.getElementById(this.componentId);
        this.elements.track = document.getElementById(`${this.componentId}-track`);
        this.elements.prevBtn = document.getElementById(`${this.componentId}-prev`);
        this.elements.nextBtn = document.getElementById(`${this.componentId}-next`);
        this.elements.dotsContainer = document.getElementById(`${this.componentId}-dots`);
        this.elements.thumbnailsContainer = document.getElementById(`${this.componentId}-thumbs`);
        this.elements.slides = [];
        this.elements.dots = [];
        this.elements.thumbnails = [];
        this.config.slides.forEach((_, index) => {
            this.elements.slides[index] = document.getElementById(`${this.componentId}-slide-${index}`);
            this.elements.dots[index] = document.getElementById(`${this.componentId}-dot-${index}`);
        });
    }

    bindEvents() {
        if (this.elements.prevBtn) {
            this.elements.prevBtn.addEventListener('click', () => this.previousSlide());
        }
        if (this.elements.nextBtn) {
            this.elements.nextBtn.addEventListener('click', () => this.nextSlide());
        }
        if (this.elements.dotsContainer) {
            this.elements.dotsContainer.addEventListener('click', (e) => {
                const dot = e.target.closest('.car-dot');
                if (dot) this.goToSlide(parseInt(dot.dataset.index));
            });
        }
        if (this.elements.thumbnailsContainer) {
            this.elements.thumbnailsContainer.addEventListener('click', (e) => {
                const thumb = e.target.closest('.car-thumb');
                if (thumb) this.goToSlide(parseInt(thumb.dataset.index));
            });
        }
        if (this.config.swipe && this.elements.wrapper) {
            this.elements.wrapper.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
            this.elements.wrapper.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
            this.elements.wrapper.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        }
        if (this.config.keyboard) {
            document.addEventListener('keydown', (e) => {
                if (!this.elements.wrapper?.contains(document.activeElement)) return;
                if (e.key === 'ArrowLeft') { e.preventDefault(); this.previousSlide(); }
                if (e.key === 'ArrowRight') { e.preventDefault(); this.nextSlide(); }
            });
        }
        if (this.config.pauseOnHover && this.elements.wrapper) {
            this.elements.wrapper.addEventListener('mouseenter', () => { this.state.isHovered = true; this.pauseAutoPlay(); });
            this.elements.wrapper.addEventListener('mouseleave', () => { this.state.isHovered = false; this.resumeAutoPlay(); });
        }
        console.log('[Carousel] Events bound');
    }

    handleTouchStart(e) {
        this.state.touchStartX = e.touches[0].clientX;
        this.state.touchStartY = e.touches[0].clientY;
        this.state.isSwiping = true;
        this.state.touchDeltaX = 0;
    }

    handleTouchMove(e) {
        if (!this.state.isSwiping) return;
        this.state.touchDeltaX = this.state.touchStartX - e.touches[0].clientX;
        this.state.touchDeltaY = this.state.touchStartY - e.touches[0].clientY;
        if (Math.abs(this.state.touchDeltaX) > Math.abs(this.state.touchDeltaY)) {
            e.preventDefault();
        }
    }

    handleTouchEnd() {
        if (!this.state.isSwiping) return;
        this.state.isSwiping = false;
        if (Math.abs(this.state.touchDeltaX) > this.config.swipeThreshold) {
            if (this.state.touchDeltaX > 0) {
                this.nextSlide();
            } else {
                this.previousSlide();
            }
            if (this.config.onSwipe) {
                this.config.onSwipe(this.state.touchDeltaX > 0 ? 'left' : 'right');
            }
        }
    }

    goToSlide(index) {
        if (this.state.isAnimating) return;
        if (index < 0 || index >= this.state.slideCount) {
            if (this.config.infinite) {
                index = index < 0 ? this.state.slideCount - 1 : 0;
            } else {
                return;
            }
        }
        this.state.isAnimating = true;
        this.state.previousIndex = this.state.activeIndex;
        this.state.activeIndex = index;
        this.updateTrack();
        this.updateIndicators();
        if (this.config.lazyLoad) this.loadLazyImages();
        if (this.config.onSlideChange) {
            this.config.onSlideChange(index, this.state.previousIndex);
        }
        EventBus.emit('carousel:slide-changed', {
            componentId: this.componentId, activeIndex: index, previousIndex: this.state.previousIndex
        });
        clearTimeout(this.state.animationTimer);
        this.state.animationTimer = setTimeout(() => { this.state.isAnimating = false; }, this.config.transitionDuration);
    }

    nextSlide() {
        const nextIndex = this.state.activeIndex + 1;
        if (nextIndex >= this.state.slideCount && this.config.infinite) {
            this.goToSlide(0);
        } else if (nextIndex < this.state.slideCount) {
            this.goToSlide(nextIndex);
        }
    }

    previousSlide() {
        const prevIndex = this.state.activeIndex - 1;
        if (prevIndex < 0 && this.config.infinite) {
            this.goToSlide(this.state.slideCount - 1);
        } else if (prevIndex >= 0) {
            this.goToSlide(prevIndex);
        }
    }

    updateTrack() {
        if (!this.elements.track) return;
        const slideWidth = 100 / this.config.slidesToShow;
        const offset = -this.state.activeIndex * slideWidth;
        this.elements.track.style.transition = `transform ${this.config.transitionDuration}ms ${this.config.easing}`;
        this.elements.track.style.transform = `translateX(${offset}%)`;
        this.elements.slides.forEach((slide, index) => {
            if (slide) {
                slide.classList.toggle('active', index === this.state.activeIndex);
                slide.setAttribute('aria-hidden', index !== this.state.activeIndex ? 'true' : 'false');
            }
        });
    }

    updateIndicators() {
        this.elements.dots.forEach((dot, index) => {
            if (dot) {
                dot.classList.toggle('active', index === this.state.activeIndex);
                dot.setAttribute('aria-selected', index === this.state.activeIndex ? 'true' : 'false');
            }
        });
        const thumbnails = this.elements.thumbnailsContainer?.querySelectorAll('.car-thumb');
        thumbnails?.forEach((thumb, index) => {
            thumb.classList.toggle('active', index === this.state.activeIndex);
        });
    }

    startAutoPlay() {
        if (this.state.slideCount <= 1) return;
        this.stopAutoPlay();
        this.state.isAutoPlaying = true;
        this.state.autoPlayTimer = setInterval(() => {
            if (!this.state.isHovered && !this.state.isFocused) {
                this.nextSlide();
            }
        }, this.config.autoPlayInterval);
    }

    stopAutoPlay() {
        if (this.state.autoPlayTimer) {
            clearInterval(this.state.autoPlayTimer);
            this.state.autoPlayTimer = null;
        }
        this.state.isAutoPlaying = false;
    }

    pauseAutoPlay() {
        if (this.state.autoPlayTimer) {
            clearInterval(this.state.autoPlayTimer);
            this.state.autoPlayTimer = null;
        }
    }

    resumeAutoPlay() {
        if (this.config.autoPlay && !this.state.isAutoPlaying) {
            this.startAutoPlay();
        }
    }

    preloadImages() {
        this.config.slides.forEach((slide, index) => {
            if (slide.image || slide.src) {
                const img = new Image();
                img.src = slide.image || slide.src;
                img.onload = () => this.state.loadedImages.add(index);
            }
        });
    }

    loadLazyImages() {
        const startIndex = Math.max(0, this.state.activeIndex - this.config.lazyLoadOffset);
        const endIndex = Math.min(this.state.slideCount - 1, this.state.activeIndex + this.config.lazyLoadOffset);
        for (let i = startIndex; i <= endIndex; i++) {
            const slide = this.elements.slides[i];
            const img = slide?.querySelector('img[data-src]');
            if (img && img.dataset.src) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            }
        }
    }

    addSlide(slide, index = -1) {
        const insertIndex = index >= 0 ? index : this.config.slides.length;
        this.config.slides.splice(insertIndex, 0, slide);
        this.state.slideCount = this.config.slides.length;
        this.render();
        this.bindEvents();
    }

    removeSlide(index) {
        if (index < 0 || index >= this.config.slides.length) return;
        this.config.slides.splice(index, 1);
        this.state.slideCount = this.config.slides.length;
        if (this.state.activeIndex >= this.state.slideCount) {
            this.state.activeIndex = Math.max(0, this.state.slideCount - 1);
        }
        this.render();
        this.bindEvents();
    }

    getActiveIndex() { return this.state.activeIndex; }
    getSlideCount() { return this.state.slideCount; }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    destroy() {
        this.stopAutoPlay();
        clearTimeout(this.state.animationTimer);
        if (this.container) this.container.innerHTML = '';
        console.log('[Carousel] Component destroyed');
    }

    static create(container, options) {
        const instance = new Carousel(container, options);
        if (!window.Global) window.Global = {};
        if (!window.Global.Carousel) window.Global.Carousel = {};
        if (!window.Global.Carousel.instances) window.Global.Carousel.instances = new Map();
        window.Global.Carousel.instances.set(instance.componentId, instance);
        return instance;
    }
}

export { Carousel };
export default Carousel;
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Carousel = window.Global.Carousel || {};
    window.Global.Carousel.instances = window.Global.Carousel.instances || new Map();
    window.Global.Carousel.Carousel = Carousel;
}

