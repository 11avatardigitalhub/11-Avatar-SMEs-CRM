/**
 * 11 AVATAR DIGITAL HUB - Training Module
 * Enterprise-grade training & learning management system
 * Course creation, enrollment, progress tracking, assessments, certifications
 * 
 * @module Training
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { State } from '../core/state.js';
import { API } from '../core/api.js';
import { Cache } from '../core/cache.js';
import { Permissions } from '../auth/permissions.js';
import { Formatters } from '../utils/formatters.js';
import { Validators } from '../utils/validators.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';

/**
 * Training Module - Complete LMS lifecycle management
 * Handles courses, modules, lessons, quizzes, enrollments, certifications
 */
class TrainingModule {
    constructor() {
        // Module identity
        this.moduleName = 'training';
        this.apiEndpoint = '/api/training';
        this.cachePrefix = 'training_';
        this.cacheTimeout = 15 * 60 * 1000; // 15 minutes
        
        // Course status definitions
        this.courseStatuses = {
            'draft': { label: 'Draft', color: '#6B7280', icon: 'fa-pencil-alt' },
            'published': { label: 'Published', color: '#10B981', icon: 'fa-check-circle' },
            'archived': { label: 'Archived', color: '#9CA3AF', icon: 'fa-archive' },
            'under_review': { label: 'Under Review', color: '#F59E0B', icon: 'fa-search' }
        };
        
        // Course difficulty levels
        this.difficultyLevels = {
            'beginner': { label: 'Beginner', color: '#10B981', icon: 'fa-seedling' },
            'intermediate': { label: 'Intermediate', color: '#3B82F6', icon: 'fa-tree' },
            'advanced': { label: 'Advanced', color: '#F97316', icon: 'fa-mountain' },
            'expert': { label: 'Expert', color: '#DC2626', icon: 'fa-crown' }
        };
        
        // Content types
        this.contentTypes = {
            'video': { label: 'Video', icon: 'fa-video', color: '#EC4899' },
            'document': { label: 'Document', icon: 'fa-file-alt', color: '#3B82F6' },
            'quiz': { label: 'Quiz', icon: 'fa-question-circle', color: '#F59E0B' },
            'assignment': { label: 'Assignment', icon: 'fa-tasks', color: '#8B5CF6' },
            'live_session': { label: 'Live Session', icon: 'fa-broadcast-tower', color: '#14B8A6' },
            'interactive': { label: 'Interactive', icon: 'fa-hand-pointer', color: '#F97316' },
            'webinar': { label: 'Webinar', icon: 'fa-video', color: '#DC2626' },
            'reading': { label: 'Reading', icon: 'fa-book', color: '#6B7280' }
        };
        
        // Enrollment statuses
        this.enrollmentStatuses = {
            'enrolled': { label: 'Enrolled', color: '#3B82F6', icon: 'fa-user-plus' },
            'in_progress': { label: 'In Progress', color: '#F59E0B', icon: 'fa-spinner' },
            'completed': { label: 'Completed', color: '#10B981', icon: 'fa-check-circle' },
            'failed': { label: 'Failed', color: '#DC2626', icon: 'fa-times-circle' },
            'dropped': { label: 'Dropped', color: '#6B7280', icon: 'fa-user-minus' },
            'on_hold': { label: 'On Hold', color: '#8B5CF6', icon: 'fa-pause-circle' }
        };
        
        // Assessment types
        this.assessmentTypes = {
            'multiple_choice': { label: 'Multiple Choice', icon: 'fa-list-ul' },
            'true_false': { label: 'True/False', icon: 'fa-toggle-on' },
            'short_answer': { label: 'Short Answer', icon: 'fa-pen' },
            'essay': { label: 'Essay', icon: 'fa-file-alt' },
            'coding': { label: 'Coding Exercise', icon: 'fa-code' },
            'practical': { label: 'Practical', icon: 'fa-flask' },
            'peer_review': { label: 'Peer Review', icon: 'fa-users' }
        };
        
        // Certification levels
        this.certificationLevels = {
            'participation': { label: 'Participation', color: '#6B7280' },
            'completion': { label: 'Completion', color: '#3B82F6' },
            'merit': { label: 'Merit', color: '#10B981' },
            'distinction': { label: 'Distinction', color: '#F59E0B' },
            'excellence': { label: 'Excellence', color: '#8B5CF6' }
        };
        
        // Module state
        this.courses = new Map();
        this.enrollments = new Map(); // courseId -> [enrollments]
        this.selectedCourseId = null;
        this.selectedLessonId = null;
        
        // Learning paths
        this.learningPaths = new Map();
        
        // Assessments & grades
        this.assessments = new Map(); // lessonId -> assessment
        this.grades = new Map(); // enrollmentId -> [grades]
        
        // Certificates
        this.certificates = new Map(); // enrollmentId -> certificate
        
        // Filters
        this.filters = {
            status: 'all',
            difficulty: 'all',
            category: 'all',
            instructor: 'all',
            search: '',
            priceRange: null,
            rating: null
        };
        
        // Sort config
        this.sortConfig = {
            field: 'updatedAt',
            order: 'desc'
        };
        
        // Pagination
        this.pagination = {
            page: 1,
            limit: 12,
            total: 0,
            totalPages: 0
        };
        
        // View state
        this.currentView = 'grid'; // grid, list, detail, learn
        this.isLearningMode = false;
        
        // Progress tracking
        this.progressCache = new Map();
        
        // Performance metrics
        this.metrics = {
            totalCourses: 0,
            publishedCourses: 0,
            totalEnrollments: 0,
            activeStudents: 0,
            completionRate: 0,
            averageRating: 0,
            totalRevenue: 0,
            certificatesIssued: 0,
            lastCalculated: null
        };
        
        // DOM references
        this.elements = {
            container: null,
            courseGrid: null,
            courseList: null,
            courseDetail: null,
            learningView: null,
            filterBar: null,
            searchInput: null,
            createButton: null,
            metricsPanel: null,
            categoryFilter: null
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize training module
     */
    async init() {
        try {
            const startTime = performance.now();
            
            console.log('[Training] Initializing training management module...');
            
            // Check permissions
            const canAccess = await Permissions.check('training', 'read');
            if (!canAccess) {
                Toast.show('Access denied: Training module requires permissions', 'error');
                EventBus.emit('route:navigate', '/dashboard');
                return;
            }
            
            // Cache DOM
            this.cacheDOM();
            
            // Load courses
            await this.loadCourses();
            
            // Load learning paths
            await this.loadLearningPaths();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Calculate metrics
            this.calculateMetrics();
            
            // Render
            await this.render();
            
            const loadTime = performance.now() - startTime;
            console.log(`[Training] Initialized in ${loadTime.toFixed(2)}ms`);
            
            EventBus.emit('training:ready', {
                courses: this.courses.size,
                metrics: this.metrics
            });
            
        } catch (error) {
            console.error('[Training] Initialization failed:', error);
            Toast.show('Failed to load training module', 'error');
        }
    }
    
    /**
     * Cache DOM elements
     */
    cacheDOM() {
        try {
            const selectors = {
                container: '#training-container',
                courseGrid: '#courses-grid',
                courseList: '#courses-list',
                courseDetail: '#course-detail',
                learningView: '#learning-view',
                filterBar: '#training-filters',
                searchInput: '#training-search',
                createButton: '#course-create-btn',
                metricsPanel: '#training-metrics',
                categoryFilter: '#category-filter'
            };
            
            for (const [key, selector] of Object.entries(selectors)) {
                const element = document.querySelector(selector);
                if (element) {
                    this.elements[key] = element;
                }
            }
            
            console.log('[Training] DOM elements cached');
            
        } catch (error) {
            console.error('[Training] DOM cache failed:', error);
        }
    }
    
    /**
     * Load courses
     */
    async loadCourses(page = 1) {
        try {
            this.pagination.page = page;
            
            const params = new URLSearchParams({
                page: page.toString(),
                limit: this.pagination.limit.toString(),
                sortBy: this.sortConfig.field,
                sortOrder: this.sortConfig.order
            });
            
            if (this.filters.status !== 'all') params.set('status', this.filters.status);
            if (this.filters.difficulty !== 'all') params.set('difficulty', this.filters.difficulty);
            if (this.filters.category !== 'all') params.set('category', this.filters.category);
            if (this.filters.search) params.set('search', this.filters.search);
            
            const isDefaultFilters = this.areDefaultFilters();
            
            if (isDefaultFilters && page === 1) {
                const cached = await Cache.get(`${this.cachePrefix}courses`);
                if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
                    this.processCoursesData(cached.data);
                    return;
                }
            }
            
            const response = await API.get(`${this.apiEndpoint}/courses?${params.toString()}`);
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to load courses');
            }
            
            this.processCoursesData(response.data);
            
            if (isDefaultFilters && page === 1) {
                await Cache.set(`${this.cachePrefix}courses`, response.data, this.cacheTimeout);
            }
            
            console.log(`[Training] Loaded ${this.courses.size} courses`);
            
        } catch (error) {
            console.error('[Training] Courses load failed:', error);
            Toast.show('Failed to load courses', 'error');
        }
    }
    
    /**
     * Process courses data
     */
    processCoursesData(data) {
        try {
            this.courses.clear();
            
            if (data.courses && Array.isArray(data.courses)) {
                data.courses.forEach(course => {
                    const processed = {
                        ...course,
                        // Format fields
                        formattedCreated: Formatters.date(course.createdAt),
                        formattedUpdated: Formatters.relativeTime(course.updatedAt),
                        formattedDuration: this.formatDuration(course.duration),
                        
                        // Status info
                        statusInfo: this.courseStatuses[course.status] || this.courseStatuses.draft,
                        
                        // Difficulty info
                        difficultyInfo: this.difficultyLevels[course.difficulty] || this.difficultyLevels.beginner,
                        
                        // Derived fields
                        lessonCount: course.lessons?.length || 0,
                        moduleCount: course.modules?.length || 0,
                        enrollmentCount: course.enrollments?.length || 0,
                        completionCount: course.enrollments?.filter(e => e.status === 'completed').length || 0,
                        averageRating: course.rating || 0,
                        ratingStars: this.generateRatingStars(course.rating || 0),
                        
                        // Content summary
                        contentBreakdown: this.getContentBreakdown(course),
                        
                        // Instructor info
                        instructorName: course.instructor?.name || 'Unknown',
                        instructorAvatar: course.instructor?.avatar || null,
                        
                        // Pricing
                        isFree: !course.price || course.price === 0,
                        formattedPrice: course.price ? Formatters.currency(course.price) : 'Free',
                        
                        // Flags
                        hasCertificate: course.certificateEnabled || false,
                        hasAssessment: course.modules?.some(m => 
                            m.lessons?.some(l => l.assessment)
                        ) || false,
                        isPublished: course.status === 'published',
                        canEdit: course.status !== 'archived'
                    };
                    
                    this.courses.set(course.id, processed);
                });
            }
            
            if (data.pagination) {
                this.pagination.total = data.pagination.total || 0;
                this.pagination.totalPages = data.pagination.totalPages || 1;
            }
            
        } catch (error) {
            console.error('[Training] Data processing failed:', error);
        }
    }
    
    /**
     * Load learning paths
     */
    async loadLearningPaths() {
        try {
            const response = await API.get(`${this.apiEndpoint}/learning-paths`);
            
            if (response.success && response.data) {
                this.learningPaths.clear();
                response.data.forEach(path => {
                    this.learningPaths.set(path.id, path);
                });
                
                console.log(`[Training] Loaded ${this.learningPaths.size} learning paths`);
            }
            
        } catch (error) {
            console.error('[Training] Learning paths load failed:', error);
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        try {
            if (this.elements.searchInput) {
                this.elements.searchInput.addEventListener('input',
                    this.debounce(this.handleSearch.bind(this), 300)
                );
            }
            
            if (this.elements.filterBar) {
                this.elements.filterBar.addEventListener('change', (e) => {
                    if (e.target.dataset.filter) {
                        this.handleFilterChange(e.target.dataset.filter, e.target.value);
                    }
                });
            }
            
            if (this.elements.createButton) {
                this.elements.createButton.addEventListener('click', () => {
                    this.openCreateCourse();
                });
            }
            
            EventBus.on('course:create', this.createCourse.bind(this));
            EventBus.on('course:update', this.updateCourse.bind(this));
            EventBus.on('course:delete', this.deleteCourse.bind(this));
            EventBus.on('course:enroll', this.enrollStudent.bind(this));
            EventBus.on('lesson:complete', this.completeLesson.bind(this));
            EventBus.on('assessment:submit', this.submitAssessment.bind(this));
            EventBus.on('certificate:issue', this.issueCertificate.bind(this));
            
            console.log('[Training] Event listeners initialized');
            
        } catch (error) {
            console.error('[Training] Event listener setup failed:', error);
        }
    }
    
    /**
     * Render training view
     */
    async render() {
        try {
            if (!this.elements.container) return;
            
            switch (this.currentView) {
                case 'grid':
                    await this.renderGridView();
                    break;
                case 'list':
                    await this.renderListView();
                    break;
                case 'detail':
                    await this.renderDetailView();
                    break;
                case 'learn':
                    await this.renderLearningView();
                    break;
                default:
                    await this.renderGridView();
            }
            
        } catch (error) {
            console.error('[Training] Render failed:', error);
        }
    }
    
    /**
     * Render grid view with course cards
     */
    async renderGridView() {
        try {
            const html = `
                <div class="training-grid-container">
                    <!-- Metrics Dashboard -->
                    <div class="training-metrics">
                        <div class="metric-card">
                            <i class="fas fa-book-open"></i>
                            <div class="metric-data">
                                <span class="metric-value">${this.metrics.totalCourses}</span>
                                <span class="metric-label">Total Courses</span>
                            </div>
                        </div>
                        
                        <div class="metric-card success">
                            <i class="fas fa-check-circle"></i>
                            <div class="metric-data">
                                <span class="metric-value">${this.metrics.publishedCourses}</span>
                                <span class="metric-label">Published</span>
                            </div>
                        </div>
                        
                        <div class="metric-card info">
                            <i class="fas fa-users"></i>
                            <div class="metric-data">
                                <span class="metric-value">${this.metrics.totalEnrollments}</span>
                                <span class="metric-label">Enrollments</span>
                            </div>
                        </div>
                        
                        <div class="metric-card warning">
                            <i class="fas fa-user-graduate"></i>
                            <div class="metric-data">
                                <span class="metric-value">${this.metrics.activeStudents}</span>
                                <span class="metric-label">Active Students</span>
                            </div>
                        </div>
                        
                        <div class="metric-card purple">
                            <i class="fas fa-trophy"></i>
                            <div class="metric-data">
                                <span class="metric-value">${this.metrics.completionRate}%</span>
                                <span class="metric-label">Completion Rate</span>
                            </div>
                        </div>
                        
                        <div class="metric-card">
                            <i class="fas fa-certificate"></i>
                            <div class="metric-data">
                                <span class="metric-value">${this.metrics.certificatesIssued}</span>
                                <span class="metric-label">Certificates</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Category Filters -->
                    <div class="category-filters">
                        <button class="category-filter active" onclick="window.Global.Training.filterByCategory('all')">
                            All Courses
                        </button>
                        <button class="category-filter" onclick="window.Global.Training.filterByCategory('technical')">
                            <i class="fas fa-code"></i> Technical
                        </button>
                        <button class="category-filter" onclick="window.Global.Training.filterByCategory('business')">
                            <i class="fas fa-briefcase"></i> Business
                        </button>
                        <button class="category-filter" onclick="window.Global.Training.filterByCategory('soft_skills')">
                            <i class="fas fa-comments"></i> Soft Skills
                        </button>
                        <button class="category-filter" onclick="window.Global.Training.filterByCategory('compliance')">
                            <i class="fas fa-shield-alt"></i> Compliance
                        </button>
                    </div>
                    
                    <!-- Course Cards Grid -->
                    <div class="courses-grid" id="courses-grid">
                        ${this.renderCourseCards()}
                    </div>
                    
                    ${this.courses.size === 0 ? this.renderEmptyState() : ''}
                    ${this.renderPagination()}
                </div>
            `;
            
            if (this.elements.container) {
                this.elements.container.innerHTML = html;
            }
            
            console.log('[Training] Grid view rendered');
            
        } catch (error) {
            console.error('[Training] Grid render failed:', error);
        }
    }
    
    /**
     * Render course cards
     */
    renderCourseCards() {
        if (this.courses.size === 0) return '';
        
        let cards = '';
        
        this.courses.forEach((course) => {
            const statusInfo = course.statusInfo;
            const difficultyInfo = course.difficultyInfo;
            
            cards += `
                <div class="course-card glass-card-3d" 
                     data-course-id="${course.id}"
                     onclick="window.Global.Training.openCourseDetail('${course.id}')">
                    
                    <!-- Course Thumbnail -->
                    <div class="course-thumbnail" style="background: linear-gradient(135deg, ${difficultyInfo.color}40, ${difficultyInfo.color}10)">
                        <div class="course-type-badge" style="background: ${statusInfo.color}">
                            ${statusInfo.label}
                        </div>
                        <div class="course-difficulty" style="color: ${difficultyInfo.color}">
                            <i class="fas ${difficultyInfo.icon}"></i>
                            ${difficultyInfo.label}
                        </div>
                        ${course.isFree ? `
                            <div class="free-badge">FREE</div>
                        ` : ''}
                    </div>
                    
                    <!-- Course Info -->
                    <div class="course-info">
                        <h3 class="course-title">${this.escapeHtml(course.title)}</h3>
                        
                        <div class="course-instructor">
                            ${course.instructorAvatar ? `
                                <img src="${course.instructorAvatar}" alt="${this.escapeHtml(course.instructorName)}">
                            ` : ''}
                            <span>${this.escapeHtml(course.instructorName)}</span>
                        </div>
                        
                        <p class="course-description">
                            ${this.escapeHtml(course.description?.substring(0, 100) || '')}${course.description?.length > 100 ? '...' : ''}
                        </p>
                        
                        <!-- Course Stats -->
                        <div class="course-stats">
                            <div class="stat">
                                <i class="fas fa-book"></i>
                                <span>${course.moduleCount} Modules</span>
                            </div>
                            <div class="stat">
                                <i class="fas fa-list"></i>
                                <span>${course.lessonCount} Lessons</span>
                            </div>
                            <div class="stat">
                                <i class="fas fa-clock"></i>
                                <span>${course.formattedDuration}</span>
                            </div>
                        </div>
                        
                        <!-- Content Breakdown -->
                        <div class="content-breakdown">
                            ${Object.entries(course.contentBreakdown || {}).map(([type, count]) => `
                                ${count > 0 ? `
                                    <span class="content-type-badge" style="background: ${this.contentTypes[type]?.color || '#6B7280'}20; color: ${this.contentTypes[type]?.color || '#6B7280'}">
                                        <i class="fas ${this.contentTypes[type]?.icon}"></i>
                                        ${count} ${this.contentTypes[type]?.label}
                                    </span>
                                ` : ''}
                            `).join('')}
                        </div>
                        
                        <!-- Rating -->
                        <div class="course-rating">
                            <div class="stars">
                                ${course.ratingStars}
                            </div>
                            <span>${course.averageRating.toFixed(1)} (${course.enrollmentCount} students)</span>
                        </div>
                        
                        <!-- Enrollment Progress -->
                        <div class="enrollment-progress">
                            <div class="progress-header">
                                <span>Completion</span>
                                <span>${course.enrollmentCount > 0 ? Math.round((course.completionCount / course.enrollmentCount) * 100) : 0}%</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${course.enrollmentCount > 0 ? (course.completionCount / course.enrollmentCount) * 100 : 0}%"></div>
                            </div>
                        </div>
                        
                        <!-- Features -->
                        <div class="course-features">
                            ${course.hasCertificate ? `
                                <span class="feature-badge">
                                    <i class="fas fa-certificate"></i> Certificate
                                </span>
                            ` : ''}
                            ${course.hasAssessment ? `
                                <span class="feature-badge">
                                    <i class="fas fa-tasks"></i> Assessments
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- Card Footer -->
                    <div class="course-card-footer">
                        <div class="course-price">
                            ${course.isFree ? 
                                '<span class="free-label">Free</span>' : 
                                `<strong>${course.formattedPrice}</strong>`
                            }
                        </div>
                        <div class="card-actions" onclick="event.stopPropagation()">
                            <button class="btn btn-sm btn-primary" onclick="window.Global.Training.enrollStudent('${course.id}')">
                                <i class="fas fa-user-plus"></i> Enroll
                            </button>
                            ${course.canEdit ? `
                                <button class="btn-icon" title="Edit" onclick="window.Global.Training.editCourse('${course.id}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        
        return cards;
    }
    
    /**
     * Render learning view (when student is taking a course)
     */
    async renderLearningView() {
        try {
            if (!this.selectedCourseId) return;
            
            const course = this.courses.get(this.selectedCourseId);
            if (!course) return;
            
            const html = `
                <div class="learning-container">
                    <!-- Learning Header -->
                    <div class="learning-header">
                        <button class="btn btn-outline" onclick="window.Global.Training.exitLearningMode()">
                            <i class="fas fa-arrow-left"></i> Back to Course
                        </button>
                        <h3>${this.escapeHtml(course.title)}</h3>
                        <div class="learning-progress">
                            <span>Progress: ${this.getOverallProgress(course.id)}%</span>
                        </div>
                    </div>
                    
                    <!-- Learning Layout -->
                    <div class="learning-layout">
                        <!-- Sidebar - Course Outline -->
                        <div class="learning-sidebar">
                            <div class="course-outline">
                                <h4>Course Content</h4>
                                ${course.modules?.map((module, mIndex) => `
                                    <div class="outline-module">
                                        <div class="module-header" onclick="window.Global.Training.toggleModule(${mIndex})">
                                            <i class="fas fa-chevron-down"></i>
                                            <span>Module ${mIndex + 1}: ${this.escapeHtml(module.title)}</span>
                                            <span class="module-progress">${this.getModuleProgress(course.id, module.id)}%</span>
                                        </div>
                                        <div class="module-lessons">
                                            ${module.lessons?.map((lesson, lIndex) => `
                                                <div class="lesson-item ${lesson.id === this.selectedLessonId ? 'active' : ''} ${lesson.completed ? 'completed' : ''}"
                                                     onclick="window.Global.Training.selectLesson('${lesson.id}')">
                                                    <span class="lesson-icon">
                                                        ${lesson.completed ? 
                                                            '<i class="fas fa-check-circle"></i>' : 
                                                            `<i class="fas ${this.contentTypes[lesson.type]?.icon || 'fa-file'}"></i>`
                                                        }
                                                    </span>
                                                    <span class="lesson-title">${this.escapeHtml(lesson.title)}</span>
                                                    <span class="lesson-duration">${this.formatDuration(lesson.duration)}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <!-- Main Content Area -->
                        <div class="learning-content">
                            ${this.selectedLessonId ? this.renderLessonContent() : this.renderCourseOverview(course)}
                        </div>
                    </div>
                </div>
            `;
            
            if (this.elements.container) {
                this.elements.container.innerHTML = html;
            }
            
            console.log('[Training] Learning view rendered');
            
        } catch (error) {
            console.error('[Training] Learning view render failed:', error);
        }
    }
    
    /**
     * Render lesson content
     */
    renderLessonContent() {
        // Find the selected lesson
        let selectedLesson = null;
        let lessonModule = null;
        
        const course = this.courses.get(this.selectedCourseId);
        if (!course) return '';
        
        for (const module of course.modules || []) {
            for (const lesson of module.lessons || []) {
                if (lesson.id === this.selectedLessonId) {
                    selectedLesson = lesson;
                    lessonModule = module;
                    break;
                }
            }
            if (selectedLesson) break;
        }
        
        if (!selectedLesson) return '<div class="lesson-not-found">Lesson not found</div>';
        
        const contentType = this.contentTypes[selectedLesson.type] || this.contentTypes.document;
        
        return `
            <div class="lesson-content-container">
                <!-- Lesson Header -->
                <div class="lesson-header">
                    <span class="content-type-badge" style="background: ${contentType.color}20; color: ${contentType.color}">
                        <i class="fas ${contentType.icon}"></i>
                        ${contentType.label}
                    </span>
                    <h2>${this.escapeHtml(selectedLesson.title)}</h2>
                    <div class="lesson-meta">
                        <span>Module: ${this.escapeHtml(lessonModule?.title || '')}</span>
                        <span>Duration: ${this.formatDuration(selectedLesson.duration)}</span>
                    </div>
                </div>
                
                <!-- Content based on type -->
                <div class="lesson-body">
                    ${this.renderContentByType(selectedLesson)}
                </div>
                
                <!-- Lesson Navigation -->
                <div class="lesson-navigation">
                    <button class="btn btn-outline" onclick="window.Global.Training.previousLesson()">
                        <i class="fas fa-arrow-left"></i> Previous
                    </button>
                    <button class="btn btn-primary" onclick="window.Global.Training.completeLesson('${selectedLesson.id}')">
                        Mark as Complete <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-outline" onclick="window.Global.Training.nextLesson()">
                        Next <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
                
                <!-- Assessment Section -->
                ${selectedLesson.assessment ? this.renderAssessment(selectedLesson.assessment) : ''}
            </div>
        `;
    }
    
    /**
     * Render content by type
     */
    renderContentByType(lesson) {
        switch (lesson.type) {
            case 'video':
                return `
                    <div class="video-container">
                        <video controls class="lesson-video">
                            <source src="${lesson.contentUrl}" type="video/mp4">
                            Your browser does not support video playback.
                        </video>
                        ${lesson.transcript ? `
                            <div class="video-transcript">
                                <h4>Transcript</h4>
                                <p>${this.escapeHtml(lesson.transcript)}</p>
                            </div>
                        ` : ''}
                    </div>
                `;
                
            case 'document':
                return `
                    <div class="document-viewer">
                        <iframe src="${lesson.contentUrl}" width="100%" height="600px"></iframe>
                    </div>
                `;
                
            case 'reading':
                return `
                    <div class="reading-content">
                        ${lesson.content || '<p>No content available</p>'}
                    </div>
                `;
                
            case 'live_session':
                return `
                    <div class="live-session-info">
                        <div class="session-card">
                            <h4><i class="fas fa-calendar"></i> Live Session</h4>
                            <p><strong>Date:</strong> ${Formatters.date(lesson.sessionDate)}</p>
                            <p><strong>Time:</strong> ${lesson.sessionTime}</p>
                            <p><strong>Duration:</strong> ${this.formatDuration(lesson.duration)}</p>
                            ${lesson.meetingLink ? `
                                <a href="${lesson.meetingLink}" target="_blank" class="btn btn-primary">
                                    <i class="fas fa-video"></i> Join Session
                                </a>
                            ` : ''}
                        </div>
                    </div>
                `;
                
            case 'quiz':
                return this.renderQuiz(lesson);
                
            default:
                return `<div class="generic-content">${lesson.content || 'Content not available'}</div>`;
        }
    }
    
    /**
     * Render quiz
     */
    renderQuiz(lesson) {
        if (!lesson.questions || lesson.questions.length === 0) {
            return '<div class="no-questions">No questions available</div>';
        }
        
        return `
            <div class="quiz-container">
                <h4>Quiz: ${this.escapeHtml(lesson.title)}</h4>
                <p>${lesson.questions.length} questions • Passing score: ${lesson.passingScore || 70}%</p>
                
                <form id="quiz-form" onsubmit="window.Global.Training.submitQuiz(event, '${lesson.id}')">
                    ${lesson.questions.map((question, qIndex) => `
                        <div class="quiz-question">
                            <h5>Question ${qIndex + 1}: ${this.escapeHtml(question.text)}</h5>
                            ${question.type === 'multiple_choice' ? `
                                <div class="quiz-options">
                                    ${question.options?.map((option, oIndex) => `
                                        <label class="quiz-option">
                                            <input type="radio" name="q_${qIndex}" value="${oIndex}">
                                            <span>${this.escapeHtml(option)}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            ` : ''}
                            ${question.type === 'true_false' ? `
                                <div class="quiz-options">
                                    <label class="quiz-option">
                                        <input type="radio" name="q_${qIndex}" value="true">
                                        <span>True</span>
                                    </label>
                                    <label class="quiz-option">
                                        <input type="radio" name="q_${qIndex}" value="false">
                                        <span>False</span>
                                    </label>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                    
                    <button type="submit" class="btn btn-primary">
                        Submit Quiz
                    </button>
                </form>
            </div>
        `;
    }
    
    /**
     * Render assessment
     */
    renderAssessment(assessment) {
        return `
            <div class="assessment-section">
                <h4><i class="fas fa-tasks"></i> Assessment: ${this.escapeHtml(assessment.title)}</h4>
                <p>Passing score: ${assessment.passingScore || 70}%</p>
                <p>Attempts allowed: ${assessment.maxAttempts || 'Unlimited'}</p>
                
                <div id="assessment-container">
                    <!-- Assessment rendered dynamically based on type -->
                </div>
            </div>
        `;
    }
    
    /**
     * Open create course modal
     */
    async openCreateCourse(courseData = null) {
        try {
            const isEditing = !!courseData;
            const title = isEditing ? 'Edit Course' : 'Create New Course';
            
            const formHtml = `
                <div class="course-form-container">
                    <form id="course-form">
                        <!-- Basic Information -->
                        <div class="form-section">
                            <h4><i class="fas fa-info-circle"></i> Course Information</h4>
                            <div class="form-row">
                                <div class="form-group col-8">
                                    <label for="course-title">Course Title *</label>
                                    <input type="text" id="course-title" name="title" 
                                           value="${courseData?.title || ''}" required maxlength="200">
                                </div>
                                <div class="form-group col-4">
                                    <label for="course-code">Course Code</label>
                                    <input type="text" id="course-code" name="code" 
                                           value="${courseData?.code || this.generateCourseCode()}" readonly>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="course-description">Description *</label>
                                <textarea id="course-description" name="description" rows="4" required>${courseData?.description || ''}</textarea>
                            </div>
                            
                            <div class="form-group">
                                <label for="course-objectives">Learning Objectives</label>
                                <textarea id="course-objectives" name="objectives" rows="3">${courseData?.objectives || ''}</textarea>
                            </div>
                        </div>
                        
                        <!-- Course Details -->
                        <div class="form-section">
                            <h4><i class="fas fa-cog"></i> Course Settings</h4>
                            <div class="form-row">
                                <div class="form-group col-3">
                                    <label for="course-category">Category *</label>
                                    <select id="course-category" name="category" required>
                                        <option value="technical">Technical</option>
                                        <option value="business">Business</option>
                                        <option value="soft_skills">Soft Skills</option>
                                        <option value="compliance">Compliance</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div class="form-group col-3">
                                    <label for="course-difficulty">Difficulty *</label>
                                    <select id="course-difficulty" name="difficulty" required>
                                        ${Object.entries(this.difficultyLevels).map(([key, level]) => `
                                            <option value="${key}" ${courseData?.difficulty === key ? 'selected' : ''}>
                                                ${level.label}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group col-3">
                                    <label for="course-duration">Duration (hours)</label>
                                    <input type="number" id="course-duration" name="duration" 
                                           value="${courseData?.duration || ''}" min="0" step="0.5">
                                </div>
                                <div class="form-group col-3">
                                    <label for="course-status">Status</label>
                                    <select id="course-status" name="status">
                                        ${Object.entries(this.courseStatuses).map(([key, status]) => `
                                            <option value="${key}" ${courseData?.status === key ? 'selected' : ''}>
                                                ${status.label}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Pricing -->
                        <div class="form-section">
                            <h4><i class="fas fa-rupee-sign"></i> Pricing</h4>
                            <div class="form-row">
                                <div class="form-group col-4">
                                    <label for="course-price">Price</label>
                                    <div class="input-with-prefix">
                                        <span class="prefix">₹</span>
                                        <input type="number" id="course-price" name="price" 
                                               value="${courseData?.price || 0}" min="0" step="0.01">
                                    </div>
                                </div>
                                <div class="form-group col-4">
                                    <label for="course-currency">Currency</label>
                                    <select id="course-currency" name="currency">
                                        <option value="INR">INR</option>
                                        <option value="USD">USD</option>
                                    </select>
                                </div>
                                <div class="form-group col-4">
                                    <label>
                                        <input type="checkbox" name="certificateEnabled" 
                                               ${courseData?.certificateEnabled ? 'checked' : ''}>
                                        Include Certificate
                                    </label>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Instructor -->
                        <div class="form-section">
                            <h4><i class="fas fa-chalkboard-teacher"></i> Instructor</h4>
                            <div class="form-row">
                                <div class="form-group col-6">
                                    <label for="course-instructor">Instructor *</label>
                                    <select id="course-instructor" name="instructorId" required>
                                        <option value="">Select Instructor...</option>
                                    </select>
                                </div>
                                <div class="form-group col-6">
                                    <label for="course-co-instructor">Co-Instructor (Optional)</label>
                                    <select id="course-co-instructor" name="coInstructorId">
                                        <option value="">None</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Prerequisites -->
                        <div class="form-section">
                            <h4><i class="fas fa-list-alt"></i> Prerequisites</h4>
                            <div class="form-group">
                                <textarea id="course-prerequisites" name="prerequisites" rows="2" 
                                          placeholder="List any prerequisites...">${courseData?.prerequisites || ''}</textarea>
                            </div>
                        </div>
                        
                        <!-- Form Actions -->
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">
                                Cancel
                            </button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save"></i> ${isEditing ? 'Update Course' : 'Create Course'}
                            </button>
                        </div>
                    </form>
                </div>
            `;
            
            const modal = new Modal({
                title: title,
                content: formHtml,
                size: 'xlarge',
                onClose: () => {
                    this.selectedCourseId = null;
                }
            });
            
            modal.open();
            
            setTimeout(() => {
                this.setupCourseForm(isEditing, courseData);
            }, 100);
            
        } catch (error) {
            console.error('[Training] Create form open failed:', error);
            Toast.show('Failed to open course form', 'error');
        }
    }
    
    /**
     * Set up course form handlers
     */
    setupCourseForm(isEditing, courseData) {
        try {
            const form = document.getElementById('course-form');
            if (!form) return;
            
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(form);
                const data = {
                    title: formData.get('title'),
                    code: formData.get('code'),
                    description: formData.get('description'),
                    objectives: formData.get('objectives'),
                    category: formData.get('category'),
                    difficulty: formData.get('difficulty'),
                    duration: parseFloat(formData.get('duration')) || 0,
                    status: formData.get('status'),
                    price: parseFloat(formData.get('price')) || 0,
                    currency: formData.get('currency'),
                    certificateEnabled: formData.get('certificateEnabled') === 'on',
                    instructorId: formData.get('instructorId'),
                    coInstructorId: formData.get('coInstructorId'),
                    prerequisites: formData.get('prerequisites')
                };
                
                try {
                    if (isEditing && this.selectedCourseId) {
                        await this.updateCourse({ id: this.selectedCourseId, ...data });
                    } else {
                        await this.createCourse(data);
                    }
                    
                    Modal.close();
                    await this.loadCourses();
                    await this.render();
                    
                    Toast.show(
                        isEditing ? 'Course updated successfully' : 'Course created successfully',
                        'success'
                    );
                } catch (error) {
                    Toast.show('Failed to save course: ' + error.message, 'error');
                }
            });
            
        } catch (error) {
            console.error('[Training] Form setup failed:', error);
        }
    }
    
    /**
     * Generate course code
     */
    generateCourseCode() {
        const year = new Date().getFullYear().toString().slice(-2);
        const seq = String(this.courses.size + 1).padStart(4, '0');
        return `CRS-${year}-${seq}`;
    }
    
    /**
     * Get content breakdown by type
     */
    getContentBreakdown(course) {
        const breakdown = {};
        Object.keys(this.contentTypes).forEach(type => {
            breakdown[type] = 0;
        });
        
        if (course.modules) {
            course.modules.forEach(module => {
                if (module.lessons) {
                    module.lessons.forEach(lesson => {
                        if (breakdown[lesson.type] !== undefined) {
                            breakdown[lesson.type]++;
                        }
                    });
                }
            });
        }
        
        return breakdown;
    }
    
    /**
     * Generate rating stars HTML
     */
    generateRatingStars(rating) {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
        
        let stars = '';
        for (let i = 0; i < fullStars; i++) {
            stars += '<i class="fas fa-star"></i>';
        }
        if (halfStar) {
            stars += '<i class="fas fa-star-half-alt"></i>';
        }
        for (let i = 0; i < emptyStars; i++) {
            stars += '<i class="far fa-star"></i>';
        }
        
        return stars;
    }
    
    /**
     * Format duration
     */
    formatDuration(hours) {
        if (!hours || hours === 0) return '0h';
        
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        
        if (h === 0) return `${m}m`;
        if (m === 0) return `${h}h`;
        return `${h}h ${m}m`;
    }
    
    /**
     * Get overall progress for a course
     */
    getOverallProgress(courseId) {
        const cached = this.progressCache.get(courseId);
        if (cached) return cached;
        
        const course = this.courses.get(courseId);
        if (!course || !course.modules) return 0;
        
        let totalLessons = 0;
        let completedLessons = 0;
        
        course.modules.forEach(module => {
            if (module.lessons) {
                module.lessons.forEach(lesson => {
                    totalLessons++;
                    if (lesson.completed) completedLessons++;
                });
            }
        });
        
        const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
        this.progressCache.set(courseId, progress);
        
        return progress;
    }
    
    /**
     * Get module progress
     */
    getModuleProgress(courseId, moduleId) {
        const course = this.courses.get(courseId);
        if (!course) return 0;
        
        const module = course.modules?.find(m => m.id === moduleId);
        if (!module || !module.lessons) return 0;
        
        const total = module.lessons.length;
        const completed = module.lessons.filter(l => l.completed).length;
        
        return total > 0 ? Math.round((completed / total) * 100) : 0;
    }
    
    /**
     * Complete a lesson
     */
    async completeLesson(lessonId) {
        try {
            if (!this.selectedCourseId) return;
            
            const response = await API.post(`${this.apiEndpoint}/courses/${this.selectedCourseId}/lessons/${lessonId}/complete`);
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            // Update local state
            const course = this.courses.get(this.selectedCourseId);
            if (course && course.modules) {
                for (const module of course.modules) {
                    for (const lesson of module.lessons || []) {
                        if (lesson.id === lessonId) {
                            lesson.completed = true;
                            break;
                        }
                    }
                }
                this.courses.set(this.selectedCourseId, course);
            }
            
            // Clear progress cache
            this.progressCache.delete(this.selectedCourseId);
            
            // Update UI
            await this.renderLearningView();
            
            Toast.show('Lesson completed!', 'success');
            
            // Check if course is completed
            const progress = this.getOverallProgress(this.selectedCourseId);
            if (progress >= 100) {
                this.showCourseCompletion();
            }
            
        } catch (error) {
            console.error('[Training] Lesson completion failed:', error);
            Toast.show('Failed to mark lesson as complete', 'error');
        }
    }
    
    /**
     * Show course completion celebration
     */
    showCourseCompletion() {
        const course = this.courses.get(this.selectedCourseId);
        if (!course) return;
        
        const modal = new Modal({
            title: '🎉 Congratulations!',
            content: `
                <div class="course-completion">
                    <div class="completion-icon">
                        <i class="fas fa-trophy"></i>
                    </div>
                    <h3>Course Completed!</h3>
                    <p>You have successfully completed <strong>${this.escapeHtml(course.title)}</strong></p>
                    ${course.hasCertificate ? `
                        <div class="certificate-info">
                            <p>Your certificate is ready!</p>
                            <button class="btn btn-primary" onclick="window.Global.Training.issueCertificate('${this.selectedCourseId}')">
                                <i class="fas fa-certificate"></i> View Certificate
                            </button>
                        </div>
                    ` : ''}
                </div>
            `,
            size: 'medium'
        });
        
        modal.open();
    }
    
    /**
     * Issue certificate
     */
    async issueCertificate(courseId) {
        try {
            const response = await API.post(`${this.apiEndpoint}/courses/${courseId}/certificate`);
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            Toast.show('Certificate issued successfully!', 'success');
            
            // Open certificate in new tab
            if (response.data.certificateUrl) {
                window.open(response.data.certificateUrl, '_blank');
            }
            
        } catch (error) {
            console.error('[Training] Certificate issue failed:', error);
            Toast.show('Failed to issue certificate', 'error');
        }
    }
    
    /**
     * Enroll student
     */
    async enrollStudent(courseId) {
        try {
            const response = await API.post(`${this.apiEndpoint}/courses/${courseId}/enroll`);
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            Toast.show('Enrolled successfully!', 'success');
            
            // Update enrollment count
            const course = this.courses.get(courseId);
            if (course) {
                course.enrollmentCount++;
                this.courses.set(courseId, course);
            }
            
            await this.render();
            
        } catch (error) {
            console.error('[Training] Enrollment failed:', error);
            Toast.show('Failed to enroll', 'error');
        }
    }
    
    /**
     * Calculate metrics
     */
    calculateMetrics() {
        try {
            let totalCourses = 0;
            let publishedCourses = 0;
            let totalEnrollments = 0;
            let activeStudents = 0;
            let totalCompletions = 0;
            let totalRating = 0;
            let ratedCourses = 0;
            let totalRevenue = 0;
            let certificatesIssued = 0;
            
            this.courses.forEach(course => {
                totalCourses++;
                
                if (course.status === 'published') publishedCourses++;
                
                totalEnrollments += course.enrollmentCount || 0;
                totalCompletions += course.completionCount || 0;
                
                if (course.rating) {
                    totalRating += course.rating;
                    ratedCourses++;
                }
                
                totalRevenue += (course.price || 0) * (course.enrollmentCount || 0);
                certificatesIssued += course.certificatesIssued || 0;
            });
            
            this.metrics.totalCourses = totalCourses;
            this.metrics.publishedCourses = publishedCourses;
            this.metrics.totalEnrollments = totalEnrollments;
            this.metrics.activeStudents = totalEnrollments; // Simplified
            this.metrics.completionRate = totalEnrollments > 0 ? 
                Math.round((totalCompletions / totalEnrollments) * 100) : 0;
            this.metrics.averageRating = ratedCourses > 0 ? 
                parseFloat((totalRating / ratedCourses).toFixed(1)) : 0;
            this.metrics.totalRevenue = totalRevenue;
            this.metrics.certificatesIssued = certificatesIssued;
            this.metrics.lastCalculated = new Date();
            
        } catch (error) {
            console.error('[Training] Metrics calculation failed:', error);
        }
    }
    
    /**
     * Create course
     */
    async createCourse(courseData) {
        const response = await API.post(`${this.apiEndpoint}/courses`, courseData);
        if (!response.success) throw new Error(response.error);
        await Cache.delete(`${this.cachePrefix}courses`);
        return response.data;
    }
    
    /**
     * Update course
     */
    async updateCourse(courseData) {
        const response = await API.put(`${this.apiEndpoint}/courses/${courseData.id}`, courseData);
        if (!response.success) throw new Error(response.error);
        await Cache.delete(`${this.cachePrefix}courses`);
        return response.data;
    }
    
    /**
     * Render empty state
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-graduation-cap"></i>
                </div>
                <h3>No Courses Found</h3>
                <p>Create your first training course</p>
                <button class="btn btn-primary" onclick="window.Global.Training.openCreateCourse()">
                    <i class="fas fa-plus"></i> Create Course
                </button>
            </div>
        `;
    }
    
    /**
     * Render pagination
     */
    renderPagination() {
        if (this.pagination.totalPages <= 1) return '';
        
        let html = '<div class="pagination">';
        
        html += `
            <button class="page-btn" ${this.pagination.page === 1 ? 'disabled' : ''}
                    onclick="window.Global.Training.loadCourses(${this.pagination.page - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        for (let i = 1; i <= this.pagination.totalPages; i++) {
            if (i === 1 || i === this.pagination.totalPages || 
                (i >= this.pagination.page - 2 && i <= this.pagination.page + 2)) {
                html += `
                    <button class="page-btn ${i === this.pagination.page ? 'active' : ''}"
                            onclick="window.Global.Training.loadCourses(${i})">${i}</button>
                `;
            } else if (i === this.pagination.page - 3 || i === this.pagination.page + 3) {
                html += '<span class="page-ellipsis">...</span>';
            }
        }
        
        html += `
            <button class="page-btn" ${this.pagination.page === this.pagination.totalPages ? 'disabled' : ''}
                    onclick="window.Global.Training.loadCourses(${this.pagination.page + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        html += '</div>';
        return html;
    }
    
    /**
     * Are default filters
     */
    areDefaultFilters() {
        return this.filters.status === 'all' &&
               this.filters.difficulty === 'all' &&
               this.filters.category === 'all' &&
               !this.filters.search;
    }
    
    /**
     * Escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Debounce
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Clean up
     */
    destroy() {
        EventBus.off('course:create');
        EventBus.off('course:update');
        EventBus.off('course:delete');
        
        console.log('[Training] Module destroyed');
    }
}

// Singleton
const training = new TrainingModule();

// Exports
export { training, TrainingModule };
export default training;

// Global
if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.Training = training;
}
