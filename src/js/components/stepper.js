  /**
 * 11 AVATAR DIGITAL HUB - Stepper Component
 * Enterprise-grade multi-step wizard/progress component
 * Linear & non-linear, validation, persistence, animations, responsive
 * 
 * @component Stepper
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { Cache } from '../core/cache.js';
import { Validators } from '../utils/validators.js';

/**
 * Stepper - Complete multi-step wizard component
 * Form wizards, onboarding flows, checkout processes
 */
class Stepper {
    /**
     * @param {HTMLElement|string} container - Container element
     * @param {Object} options - Configuration
     */
    constructor(container, options = {}) {
        this.componentName = 'Stepper';
        this.componentId = `stp-${Date.now().toString(36)}`;
        
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        if (!this.container) throw new Error('Stepper: Container not found');

        this.config = {
            steps: options.steps || [],
            activeStep: options.activeStep || 0,
            orientation: options.orientation || 'horizontal',
            linear: options.linear !== false,
            alternative: options.alternative || false,
            showLabels: options.showLabels !== false,
            showNumbers: options.showNumbers !== false,
            showIcons: options.showIcons !== false,
            showNavigation: options.showNavigation !== false,
            showProgress: options.showProgress || false,
            allowSkip: options.allowSkip || false,
            allowBack: options.allowBack !== false,
            allowReset: options.allowReset || false,
            animation: options.animation !== false,
            animationDuration: options.animationDuration || 400,
            validateBeforeNext: options.validateBeforeNext !== false,
            persistState: options.persistState || false,
            persistenceKey: options.persistenceKey || `stepper_${this.componentId}`,
            theme: options.theme || 'light',
            size: options.size || 'md',
            labels: {
                next: options.labels?.next || 'Next',
                back: options.labels?.back || 'Back',
                finish: options.labels?.finish || 'Finish',
                reset: options.labels?.reset || 'Reset',
                skip: options.labels?.skip || 'Skip',
                step: options.labels?.step || 'Step',
                of: options.labels?.of || 'of',
                optional: options.labels?.optional || '(Optional)'
            },
            onStepChange: options.onStepChange || null,
            onBeforeStep: options.onBeforeStep || null,
            onFinish: options.onFinish || null,
            onReset: options.onReset || null,
            onValidate: options.onValidate || null
        };

        this.state = {
            activeStep: this.config.activeStep,
            completedSteps: new Set(),
            skippedSteps: new Set(),
            stepData: {},
            errors: {},
            isAnimating: false,
            isSubmitting: false,
            touchStartX: 0,
            touchCurrentX: 0,
            isSwiping: false
        };

        this.elements = {
            wrapper: null,
            header: null,
            stepsList: null,
            stepItems: [],
            body: null,
            stepPanels: [],
            navigation: null,
            prevBtn: null,
            nextBtn: null,
            finishBtn: null,
            resetBtn: null,
            skipBtn: null,
            progressBar: null
        };

        this.performance = {
            initTime: 0,
            renderTime: 0,
            stepTransitions: 0,
            lastTransition: null
        };

        this.init();
    }

    async init() {
        try {
            const startTime = performance.now();
            console.log(`[Stepper] Initializing: ${this.componentId}`);

            this.validateConfig();
            
            if (this.config.persistState) {
                await this.loadPersistedState();
            }

            await this.render();
            this.bindEvents();
            
            this.performance.initTime = performance.now() - startTime;
            console.log(`[Stepper] Initialized in ${this.performance.initTime.toFixed(2)}ms`);
            
            EventBus.emit('stepper:ready', {
                componentId: this.componentId,
                stepCount: this.config.steps.length,
                activeStep: this.state.activeStep
            });
        } catch (error) {
            console.error('[Stepper] Init failed:', error);
            this.container.innerHTML = `<div class="stp-error" role="alert">Failed to load stepper: ${this.escapeHtml(error.message)}</div>`;
        }
    }

    validateConfig() {
        if (!Array.isArray(this.config.steps) || this.config.steps.length === 0) {
            this.config.steps = [{ id: 'step-1', title: 'Step 1', content: 'No steps configured' }];
        }

        this.config.steps = this.config.steps.map((step, index) => ({
            id: step.id || `step-${index + 1}`,
            title: step.title || `Step ${index + 1}`,
            subtitle: step.subtitle || '',
            icon: step.icon || null,
            content: step.content || '',
            optional: step.optional || false,
            disabled: step.disabled || false,
            hidden: step.hidden || false,
            validate: step.validate || null,
            metadata: step.metadata || {},
            completed: step.completed || false
        }));

        if (this.config.activeStep < 0 || this.config.activeStep >= this.config.steps.length) {
            this.config.activeStep = 0;
        }

        this.state.activeStep = this.config.activeStep;
        this.state.stepData = {};
        this.state.errors = {};

        console.log('[Stepper] Config validated:', {
            steps: this.config.steps.length,
            activeStep: this.state.activeStep,
            linear: this.config.linear
        });
    }

    async loadPersistedState() {
        try {
            const cached = await Cache.get(this.config.persistenceKey);
            if (cached && cached.data) {
                if (cached.data.activeStep !== undefined && 
                    cached.data.activeStep < this.config.steps.length) {
                    this.state.activeStep = cached.data.activeStep;
                }
                if (cached.data.completedSteps) {
                    this.state.completedSteps = new Set(cached.data.completedSteps);
                }
                if (cached.data.stepData) {
                    this.state.stepData = cached.data.stepData;
                }
                console.log('[Stepper] Restored persisted state');
            }
        } catch (error) {
            console.warn('[Stepper] Failed to load persisted state:', error.message);
        }
    }

    async savePersistedState() {
        if (!this.config.persistState) return;
        try {
            await Cache.set(this.config.persistenceKey, {
                activeStep: this.state.activeStep,
                completedSteps: Array.from(this.state.completedSteps),
                stepData: this.state.stepData,
                timestamp: Date.now()
            }, 7 * 24 * 3600000);
        } catch (error) {
            console.warn('[Stepper] Failed to persist state:', error.message);
        }
    }

    async render() {
        try {
            const renderStart = performance.now();

            const orientationClass = `stp-${this.config.orientation}`;
            const alternativeClass = this.config.alternative ? 'stp-alternative' : '';
            const themeClass = `stp-theme-${this.config.theme}`;
            const sizeClass = `stp-size-${this.config.size}`;
            const animClass = this.config.animation ? 'stp-animated' : '';

            const visibleSteps = this.config.steps.filter(s => !s.hidden);
            const activeIndex = visibleSteps.indexOf(this.config.steps[this.state.activeStep]);
            const progressPercent = visibleSteps.length > 0 ? 
                Math.round(((activeIndex + 1) / visibleSteps.length) * 100) : 0;

            const html = `
                <div class="stp-wrapper ${orientationClass} ${alternativeClass} ${themeClass} ${sizeClass} ${animClass}" 
                     id="${this.componentId}" role="region" aria-label="Step wizard">
                    
                    ${this.config.showProgress ? `
                        <div class="stp-progress">
                            <div class="stp-progress-bar" role="progressbar" aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100">
                                <div class="stp-progress-fill" style="width:${progressPercent}%;"></div>
                            </div>
                            <span class="stp-progress-text">${progressPercent}% Complete</span>
                        </div>
                    ` : ''}

                    <div class="stp-header" id="${this.componentId}-header" role="tablist" aria-label="Steps">
                        ${this.renderStepIndicators()}
                    </div>

                    <div class="stp-body" id="${this.componentId}-body">
                        ${this.renderStepPanels()}
                    </div>

                    ${this.config.showNavigation ? this.renderNavigation() : ''}
                </div>
            `;

            this.container.innerHTML = html;
            this.cacheElements();
            
            this.performance.renderTime = performance.now() - renderStart;
            console.log(`[Stepper] Rendered in ${this.performance.renderTime.toFixed(2)}ms`);
        } catch (error) {
            console.error('[Stepper] Render failed:', error);
        }
    }

    renderStepIndicators() {
        return this.config.steps
            .filter(s => !s.hidden)
            .map((step, displayIndex) => {
                const actualIndex = this.config.steps.indexOf(step);
                const isActive = actualIndex === this.state.activeStep;
                const isCompleted = this.state.completedSteps.has(actualIndex) || 
                                   (this.config.linear && actualIndex < this.state.activeStep);
                const isDisabled = step.disabled;
                const isOptional = step.optional;

                let stateClass = '';
                if (isCompleted) stateClass = 'stp-completed';
                else if (isActive) stateClass = 'stp-active';
                else if (isDisabled) stateClass = 'stp-disabled';

                return `
                    <div class="stp-step ${stateClass}" 
                         id="${this.componentId}-step-${actualIndex}"
                         role="tab"
                         aria-selected="${isActive}"
                         aria-disabled="${isDisabled}"
                         data-step-index="${actualIndex}"
                         ${!this.config.linear && !isDisabled ? 'style="cursor:pointer;"' : ''}>
                        
                        <div class="stp-step-indicator" 
                             onclick="${!this.config.linear && !isDisabled ? `window.Global.Stepper.instances.get('${this.componentId}').goToStep(${actualIndex})` : ''}">
                            
                            <span class="stp-step-icon">
                                ${isCompleted ? '<i class="fas fa-check"></i>' : 
                                  this.config.showNumbers ? (displayIndex + 1) :
                                  this.config.showIcons && step.icon ? `<i class="fas ${step.icon}"></i>` : (displayIndex + 1)}
                            </span>
                        </div>

                        ${this.config.showLabels ? `
                            <div class="stp-step-label">
                                <span class="stp-step-title">${this.escapeHtml(step.title)}</span>
                                ${step.subtitle ? `<span class="stp-step-subtitle">${this.escapeHtml(step.subtitle)}</span>` : ''}
                                ${isOptional ? `<span class="stp-step-optional">${this.config.labels.optional}</span>` : ''}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
    }

    renderStepPanels() {
        return this.config.steps
            .filter(s => !s.hidden)
            .map((step, index) => {
                const actualIndex = this.config.steps.indexOf(step);
                const isActive = actualIndex === this.state.activeStep;

                return `
                    <div class="stp-panel ${isActive ? 'active' : ''}" 
                         id="${this.componentId}-panel-${actualIndex}"
                         role="tabpanel"
                         aria-labelledby="${this.componentId}-step-${actualIndex}"
                         aria-hidden="${!isActive}"
                         data-step-index="${actualIndex}"
                         ${!isActive ? 'hidden' : ''}>
                        
                        <div class="stp-panel-header">
                            <h3 class="stp-panel-title">${this.escapeHtml(step.title)}</h3>
                            ${step.subtitle ? `<p class="stp-panel-subtitle">${this.escapeHtml(step.subtitle)}</p>` : ''}
                        </div>
                        
                        <div class="stp-panel-content">
                            ${step.content}
                        </div>

                        ${this.state.errors[actualIndex] ? `
                            <div class="stp-panel-errors" role="alert">
                                <i class="fas fa-exclamation-circle"></i>
                                <span>${this.escapeHtml(this.state.errors[actualIndex])}</span>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
    }

    renderNavigation() {
        const isFirstStep = this.state.activeStep === 0;
        const isLastStep = this.state.activeStep === this.config.steps.length - 1;
        const currentStep = this.config.steps[this.state.activeStep];
        const isOptional = currentStep?.optional;
        const isDisabled = currentStep?.disabled;

        return `
            <div class="stp-navigation" id="${this.componentId}-nav">
                <div class="stp-nav-left">
                    ${this.config.allowReset && !isFirstStep ? `
                        <button class="stp-btn stp-btn-reset" id="${this.componentId}-reset" type="button">
                            <i class="fas fa-undo"></i> ${this.config.labels.reset}
                        </button>
                    ` : ''}
                </div>
                <div class="stp-nav-right">
                    ${!isFirstStep && this.config.allowBack ? `
                        <button class="stp-btn stp-btn-back" id="${this.componentId}-back" type="button">
                            <i class="fas fa-arrow-left"></i> ${this.config.labels.back}
                        </button>
                    ` : ''}
                    ${isOptional && this.config.allowSkip ? `
                        <button class="stp-btn stp-btn-skip" id="${this.componentId}-skip" type="button">
                            ${this.config.labels.skip} <i class="fas fa-forward"></i>
                        </button>
                    ` : ''}
                    ${!isLastStep ? `
                        <button class="stp-btn stp-btn-next" id="${this.componentId}-next" type="button"
                                ${isDisabled ? 'disabled' : ''}>
                            ${this.config.labels.next} <i class="fas fa-arrow-right"></i>
                        </button>
                    ` : `
                        <button class="stp-btn stp-btn-finish" id="${this.componentId}-finish" type="button"
                                ${this.state.isSubmitting ? 'disabled' : ''}>
                            ${this.state.isSubmitting ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-check"></i>'} 
                            ${this.config.labels.finish}
                        </button>
                    `}
                </div>
            </div>
        `;
    }

    cacheElements() {
        this.elements.wrapper = document.getElementById(this.componentId);
        this.elements.header = document.getElementById(`${this.componentId}-header`);
        this.elements.body = document.getElementById(`${this.componentId}-body`);
        this.elements.prevBtn = document.getElementById(`${this.componentId}-back`);
        this.elements.nextBtn = document.getElementById(`${this.componentId}-next`);
        this.elements.finishBtn = document.getElementById(`${this.componentId}-finish`);
        this.elements.resetBtn = document.getElementById(`${this.componentId}-reset`);
        this.elements.skipBtn = document.getElementById(`${this.componentId}-skip`);
        this.elements.progressBar = this.elements.wrapper?.querySelector('.stp-progress-fill');

        this.elements.stepItems = [];
        this.elements.stepPanels = [];
        
        this.config.steps.forEach((step, index) => {
            this.elements.stepItems[index] = document.getElementById(`${this.componentId}-step-${index}`);
            this.elements.stepPanels[index] = document.getElementById(`${this.componentId}-panel-${index}`);
        });
    }

    bindEvents() {
        try {
            if (this.elements.nextBtn) {
                this.elements.nextBtn.addEventListener('click', () => this.nextStep());
            }
            if (this.elements.prevBtn) {
                this.elements.prevBtn.addEventListener('click', () => this.previousStep());
            }
            if (this.elements.finishBtn) {
                this.elements.finishBtn.addEventListener('click', () => this.finish());
            }
            if (this.elements.resetBtn) {
                this.elements.resetBtn.addEventListener('click', () => this.reset());
            }
            if (this.elements.skipBtn) {
                this.elements.skipBtn.addEventListener('click', () => this.skipStep());
            }

            // Keyboard navigation
            if (this.elements.wrapper) {
                this.elements.wrapper.addEventListener('keydown', (e) => {
                    if (e.key === 'ArrowRight' && e.ctrlKey) {
                        e.preventDefault();
                        this.nextStep();
                    } else if (e.key === 'ArrowLeft' && e.ctrlKey) {
                        e.preventDefault();
                        this.previousStep();
                    }
                });
            }

            // Touch swipe for mobile
            if (this.elements.body && this.config.animation) {
                this.elements.body.addEventListener('touchstart', (e) => {
                    this.state.touchStartX = e.touches[0].clientX;
                    this.state.isSwiping = true;
                }, { passive: true });

                this.elements.body.addEventListener('touchend', (e) => {
                    if (!this.state.isSwiping) return;
                    this.state.isSwiping = false;
                    
                    const diff = this.state.touchStartX - e.changedTouches[0].clientX;
                    const threshold = 80;

                    if (Math.abs(diff) > threshold) {
                        if (diff > 0) {
                            this.nextStep();
                        } else {
                            this.previousStep();
                        }
                    }
                });
            }

            console.log('[Stepper] Events bound');
        } catch (error) {
            console.error('[Stepper] Event binding failed:', error);
        }
    }

    async nextStep() {
        if (this.state.isAnimating) return;
        
        const currentStep = this.config.steps[this.state.activeStep];

        // Validate current step before proceeding
        if (this.config.validateBeforeNext && currentStep.validate) {
            const validationResult = await this.validateCurrentStep();
            if (!validationResult.valid) {
                this.state.errors[this.state.activeStep] = validationResult.message || 'Please complete this step correctly';
                this.render();
                this.cacheElements();
                this.bindEvents();
                return;
            }
        }

        // Clear errors for current step
        delete this.state.errors[this.state.activeStep];

        // Find next non-disabled, non-hidden step
        let nextIndex = this.state.activeStep + 1;
        while (nextIndex < this.config.steps.length) {
            const nextStep = this.config.steps[nextIndex];
            if (!nextStep.disabled && !nextStep.hidden) break;
            nextIndex++;
        }

        if (nextIndex >= this.config.steps.length) {
            await this.finish();
            return;
        }

        await this.goToStep(nextIndex);
    }

    async previousStep() {
        if (this.state.isAnimating) return;
        if (!this.config.allowBack) return;
        
        let prevIndex = this.state.activeStep - 1;
        while (prevIndex >= 0) {
            const prevStep = this.config.steps[prevIndex];
            if (!prevStep.disabled && !prevStep.hidden) break;
            prevIndex--;
        }

        if (prevIndex < 0) return;
        await this.goToStep(prevIndex);
    }

    async goToStep(targetIndex) {
        if (this.state.isAnimating) return;
        if (targetIndex < 0 || targetIndex >= this.config.steps.length) return;

        const targetStep = this.config.steps[targetIndex];
        if (targetStep.disabled || targetStep.hidden) return;

        // In linear mode, can only go to completed steps or next step
        if (this.config.linear) {
            const isCompleted = this.state.completedSteps.has(targetIndex);
            const isNext = targetIndex === this.state.activeStep + 1;
            const isPrevious = targetIndex < this.state.activeStep;

            if (!isCompleted && !isNext && !isPrevious) {
                console.warn('[Stepper] Linear mode: Cannot skip to step', targetIndex);
                return;
            }
        }

        // Fire before step callback
        if (this.config.onBeforeStep) {
            const allowChange = this.config.onBeforeStep({
                fromIndex: this.state.activeStep,
                toIndex: targetIndex,
                fromStep: this.config.steps[this.state.activeStep],
                toStep: targetStep
            });
            if (allowChange === false) return;
        }

        // Mark current step as completed
        this.state.completedSteps.add(this.state.activeStep);

        // Collect step data from DOM
        this.collectStepData(this.state.activeStep);

        // Animate transition
        if (this.config.animation) {
            await this.animateStepTransition(this.state.activeStep, targetIndex);
        }

        // Update state
        const previousIndex = this.state.activeStep;
        this.state.activeStep = targetIndex;
        this.performance.stepTransitions++;
        this.performance.lastTransition = new Date();

        // Re-render
        this.render();
        this.cacheElements();
        this.bindEvents();

        // Save state
        await this.savePersistedState();

        // Focus first input in new step
        setTimeout(() => {
            const firstInput = this.elements.stepPanels[targetIndex]?.querySelector('input, textarea, select, button');
            if (firstInput && !(firstInput instanceof HTMLButtonElement)) {
                firstInput.focus();
            }
        }, this.config.animationDuration + 50);

        // Fire change callback
        if (this.config.onStepChange) {
            this.config.onStepChange({
                fromIndex: previousIndex,
                toIndex: targetIndex,
                fromStep: this.config.steps[previousIndex],
                toStep: targetStep,
                direction: targetIndex > previousIndex ? 'forward' : 'backward'
            });
        }

        EventBus.emit('stepper:step-changed', {
            componentId: this.componentId,
            fromIndex: previousIndex,
            toIndex: targetIndex,
            stepData: this.state.stepData
        });
    }

    async animateStepTransition(fromIndex, toIndex) {
        return new Promise((resolve) => {
            this.state.isAnimating = true;

            const fromPanel = this.elements.stepPanels[fromIndex];
            const toPanel = this.elements.stepPanels[toIndex];

            if (!fromPanel || !toPanel) {
                this.state.isAnimating = false;
                resolve();
                return;
            }

            const direction = toIndex > fromIndex ? 'left' : 'right';
            const exitTransform = direction === 'left' ? 'translateX(-30px)' : 'translateX(30px)';
            const enterTransform = direction === 'left' ? 'translateX(30px)' : 'translateX(-30px)';

            // Set initial animation states
            toPanel.style.opacity = '0';
            toPanel.style.transform = enterTransform;
            toPanel.style.transition = `opacity ${this.config.animationDuration}ms ease, transform ${this.config.animationDuration}ms ease`;
            toPanel.removeAttribute('hidden');

            fromPanel.style.transition = `opacity ${this.config.animationDuration}ms ease, transform ${this.config.animationDuration}ms ease`;

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    fromPanel.style.opacity = '0';
                    fromPanel.style.transform = exitTransform;
                    
                    toPanel.style.opacity = '1';
                    toPanel.style.transform = 'translateX(0)';
                });
            });

            setTimeout(() => {
                fromPanel.setAttribute('hidden', '');
                fromPanel.style.opacity = '';
                fromPanel.style.transform = '';
                fromPanel.style.transition = '';
                
                toPanel.style.opacity = '';
                toPanel.style.transform = '';
                toPanel.style.transition = '';
                
                this.state.isAnimating = false;
                resolve();
            }, this.config.animationDuration);
        });
    }

    async validateCurrentStep() {
        const currentStep = this.config.steps[this.state.activeStep];
        
        if (!currentStep.validate) {
            return { valid: true };
        }

        try {
            const panelEl = this.elements.stepPanels[this.state.activeStep];
            const formData = {};
            
            if (panelEl) {
                const inputs = panelEl.querySelectorAll('input, select, textarea');
                inputs.forEach(input => {
                    if (input.name) {
                        formData[input.name] = input.type === 'checkbox' ? input.checked : input.value;
                    }
                });
            }

            const result = await currentStep.validate(formData, this.state.stepData);
            
            if (this.config.onValidate) {
                this.config.onValidate({
                    stepIndex: this.state.activeStep,
                    step: currentStep,
                    data: formData,
                    valid: result === true || (result && result.valid !== false),
                    result
                });
            }

            if (result === true) {
                return { valid: true };
            } else if (typeof result === 'string') {
                return { valid: false, message: result };
            } else if (result && result.valid === false) {
                return result;
            }

            return { valid: true };
        } catch (error) {
            console.error('[Stepper] Validation error:', error);
            return { valid: false, message: error.message || 'Validation failed' };
        }
    }

    collectStepData(stepIndex) {
        const panelEl = this.elements.stepPanels[stepIndex];
        if (!panelEl) return;

        const stepData = {};
        const inputs = panelEl.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            if (input.name) {
                if (input.type === 'checkbox') {
                    stepData[input.name] = input.checked;
                } else if (input.type === 'radio') {
                    if (input.checked) stepData[input.name] = input.value;
                } else if (input.type === 'file') {
                    stepData[input.name] = input.files;
                } else {
                    stepData[input.name] = input.value;
                }
            }
        });

        this.state.stepData[stepIndex] = {
            ...this.state.stepData[stepIndex],
            ...stepData,
            collectedAt: new Date().toISOString()
        };
    }

    skipStep() {
        const currentStep = this.config.steps[this.state.activeStep];
        if (!currentStep.optional) return;

        this.state.skippedSteps.add(this.state.activeStep);
        this.nextStep();
    }

    async finish() {
        if (this.state.isSubmitting) return;

        // Validate final step
        if (this.config.validateBeforeNext) {
            const validationResult = await this.validateCurrentStep();
            if (!validationResult.valid) {
                this.state.errors[this.state.activeStep] = validationResult.message || 'Please complete this step correctly';
                this.render();
                this.cacheElements();
                this.bindEvents();
                return;
            }
        }

        // Collect all remaining data
        this.collectStepData(this.state.activeStep);
        this.state.completedSteps.add(this.state.activeStep);

        this.state.isSubmitting = true;
        this.render();
        this.cacheElements();
        this.bindEvents();

        try {
            const allData = {};
            this.config.steps.forEach((step, index) => {
                if (this.state.stepData[index]) {
                    Object.assign(allData, this.state.stepData[index]);
                }
            });

            console.log('[Stepper] Finishing with data:', allData);

            if (this.config.onFinish) {
                await this.config.onFinish({
                    stepData: this.state.stepData,
                    allData,
                    completedSteps: Array.from(this.state.completedSteps),
                    skippedSteps: Array.from(this.state.skippedSteps)
                });
            }

            EventBus.emit('stepper:finished', {
                componentId: this.componentId,
                data: allData,
                stepData: this.state.stepData
            });

            // Clear persisted state on successful finish
            if (this.config.persistState) {
                await Cache.delete(this.config.persistenceKey);
            }
        } catch (error) {
            console.error('[Stepper] Finish failed:', error);
            this.state.isSubmitting = false;
            this.render();
            this.cacheElements();
            this.bindEvents();
        }
    }

    async reset() {
        if (this.config.onReset) {
            const allowReset = this.config.onReset();
            if (allowReset === false) return;
        }

        this.state.activeStep = 0;
        this.state.completedSteps.clear();
        this.state.skippedSteps.clear();
        this.state.stepData = {};
        this.state.errors = {};
        this.state.isSubmitting = false;

        this.render();
        this.cacheElements();
        this.bindEvents();

        if (this.config.persistState) {
            await Cache.delete(this.config.persistenceKey);
        }

        EventBus.emit('stepper:reset', { componentId: this.componentId });
    }

    getStepData() {
        return { ...this.state.stepData };
    }

    getAllData() {
        const allData = {};
        Object.values(this.state.stepData).forEach(stepData => {
            Object.assign(allData, stepData);
        });
        return allData;
    }

    getActiveStep() {
        return this.state.activeStep;
    }

    isStepComplete(stepIndex) {
        return this.state.completedSteps.has(stepIndex);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    destroy() {
        if (this.container) this.container.innerHTML = '';
        console.log('[Stepper] Component destroyed');
    }

    static create(container, options) {
        const instance = new Stepper(container, options);
        if (!window.Global) window.Global = {};
        if (!window.Global.Stepper) window.Global.Stepper = {};
        if (!window.Global.Stepper.instances) window.Global.Stepper.instances = new Map();
        window.Global.Stepper.instances.set(instance.componentId, instance);
        return instance;
    }

    static getInstance(componentId) {
        return window.Global?.Stepper?.instances?.get(componentId) || null;
    }
}

export { Stepper };
export default Stepper;

if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Stepper = window.Global.Stepper || {};
    window.Global.Stepper.instances = window.Global.Stepper.instances || new Map();
    window.Global.Stepper.Stepper = Stepper;
}
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
