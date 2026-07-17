/**
 * 11 AVATAR DIGITAL HUB - Social Media Integration Module
 * Enterprise-grade social media management & publishing
 * Facebook, Instagram, LinkedIn, Twitter, YouTube integration with scheduling
 * 
 * @module SocialIntegration
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
 * Social Integration - Complete social media management
 * Multi-platform publishing, analytics, engagement tracking
 */
class SocialIntegration {
    constructor() {
        this.moduleName = 'social';
        this.apiEndpoint = '/api/social';
        this.cachePrefix = 'social_';
        this.cacheTimeout = 10 * 60 * 1000;

        this.platforms = {
            'facebook': {
                label: 'Facebook', icon: 'fa-facebook', color: '#1877F2',
                enabled: true, requiresOAuth: true,
                scopes: ['pages_manage_posts', 'pages_read_engagement'],
                maxPostLength: 63206, maxImages: 10, maxVideoSize: 10 * 1024 * 1024 * 1024,
                supportedFormats: ['text', 'image', 'video', 'link', 'live']
            },
            'instagram': {
                label: 'Instagram', icon: 'fa-instagram', color: '#E4405F',
                enabled: true, requiresOAuth: true,
                scopes: ['instagram_basic', 'instagram_content_publish'],
                maxPostLength: 2200, maxImages: 10, maxVideoSize: 100 * 1024 * 1024,
                supportedFormats: ['image', 'video', 'carousel', 'reel', 'story']
            },
            'linkedin': {
                label: 'LinkedIn', icon: 'fa-linkedin', color: '#0A66C2',
                enabled: true, requiresOAuth: true,
                scopes: ['w_member_social', 'r_organization_social'],
                maxPostLength: 3000, maxImages: 9, maxVideoSize: 200 * 1024 * 1024,
                supportedFormats: ['text', 'image', 'video', 'article', 'document']
            },
            'twitter': {
                label: 'Twitter/X', icon: 'fa-twitter', color: '#1DA1F2',
                enabled: true, requiresOAuth: true,
                scopes: ['tweet.read', 'tweet.write', 'users.read'],
                maxPostLength: 280, maxImages: 4, maxVideoSize: 512 * 1024 * 1024,
                supportedFormats: ['text', 'image', 'video', 'poll']
            },
            'youtube': {
                label: 'YouTube', icon: 'fa-youtube', color: '#FF0000',
                enabled: true, requiresOAuth: true,
                scopes: ['youtube.upload', 'youtube.readonly'],
                maxPostLength: 5000, maxImages: 1, maxVideoSize: 256 * 1024 * 1024 * 1024,
                supportedFormats: ['video', 'short']
            }
        };

        this.postStatuses = {
            'draft': { label: 'Draft', color: '#6B7280', icon: 'fa-pencil-alt' },
            'scheduled': { label: 'Scheduled', color: '#3B82F6', icon: 'fa-clock' },
            'publishing': { label: 'Publishing', color: '#F59E0B', icon: 'fa-spinner' },
            'published': { label: 'Published', color: '#10B981', icon: 'fa-check-circle' },
            'failed': { label: 'Failed', color: '#DC2626', icon: 'fa-times-circle' },
            'archived': { label: 'Archived', color: '#9CA3AF', icon: 'fa-archive' }
        };

        this.contentTypes = {
            'text': { label: 'Text Post', icon: 'fa-align-left', color: '#3B82F6' },
            'image': { label: 'Image', icon: 'fa-image', color: '#10B981' },
            'video': { label: 'Video', icon: 'fa-video', color: '#DC2626' },
            'link': { label: 'Link', icon: 'fa-link', color: '#8B5CF6' },
            'carousel': { label: 'Carousel', icon: 'fa-images', color: '#EC4899' },
            'reel': { label: 'Reel', icon: 'fa-film', color: '#F97316' },
            'story': { label: 'Story', icon: 'fa-circle', color: '#6366F1' },
            'poll': { label: 'Poll', icon: 'fa-poll', color: '#14B8A6' },
            'article': { label: 'Article', icon: 'fa-newspaper', color: '#F59E0B' },
            'live': { label: 'Live Stream', icon: 'fa-broadcast-tower', color: '#EF4444' }
        };

        this.connectedAccounts = new Map();
        this.posts = new Map();
        this.scheduledPosts = [];
        this.analytics = new Map();

        this.filters = {
            platform: 'all', status: 'all', type: 'all',
            search: '', dateRange: null
        };

        this.pagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
        this.currentView = 'calendar';

        this.metrics = {
            totalPosts: 0, publishedPosts: 0, scheduledPosts: 0,
            totalEngagement: 0, totalReach: 0, totalImpressions: 0,
            averageEngagementRate: 0, topPost: null, lastUpdated: null
        };

        this.init();
    }

    async init() {
        try {
            console.log('[Social] Initializing social media integration...');
            const canAccess = await Permissions.check('social', 'read');
            if (!canAccess) { console.warn('[Social] Access denied'); return; }

            await this.loadConnectedAccounts();
            await this.loadPosts();
            this.setupEventListeners();
            this.calculateMetrics();

            if (document.getElementById('social-container')) await this.render();
            console.log('[Social] Initialized');
            EventBus.emit('social:ready', { accounts: this.connectedAccounts.size, posts: this.posts.size });
        } catch (error) {
            console.error('[Social] Init failed:', error);
        }
    }

    async loadConnectedAccounts() {
        try {
            const response = await API.get(`${this.apiEndpoint}/accounts`);
            if (response.success && response.data) {
                this.connectedAccounts.clear();
                response.data.forEach(acc => {
                    this.connectedAccounts.set(acc.id, {
                        ...acc, platformInfo: this.platforms[acc.platform],
                        connectedSince: Formatters.date(acc.connectedAt),
                        isTokenValid: acc.tokenExpiresAt ? new Date(acc.tokenExpiresAt) > new Date() : true
                    });
                });
            }
        } catch (error) { console.error('[Social] Accounts load failed:', error); }
    }

    async loadPosts(page = 1) {
        try {
            this.pagination.page = page;
            const params = new URLSearchParams({ page: page.toString(), limit: this.pagination.limit.toString() });
            if (this.filters.platform !== 'all') params.set('platform', this.filters.platform);
            if (this.filters.status !== 'all') params.set('status', this.filters.status);
            if (this.filters.search) params.set('search', this.filters.search);

            const response = await API.get(`${this.apiEndpoint}/posts?${params.toString()}`);
            if (response.success && response.data) {
                this.posts.clear();
                response.data.posts?.forEach(post => {
                    this.posts.set(post.id, {
                        ...post, formattedDate: Formatters.date(post.createdAt),
                        formattedScheduledAt: post.scheduledAt ? Formatters.date(post.scheduledAt) : null,
                        statusInfo: this.postStatuses[post.status] || this.postStatuses.draft,
                        platformInfo: this.platforms[post.platform],
                        typeInfo: this.contentTypes[post.type] || this.contentTypes.text,
                        hasMedia: post.mediaUrls?.length > 0,
                        mediaCount: post.mediaUrls?.length || 0,
                        engagement: {
                            likes: post.likes || 0, comments: post.comments || 0,
                            shares: post.shares || 0, clicks: post.clicks || 0,
                            impressions: post.impressions || 0, reach: post.reach || 0,
                            engagementRate: post.impressions > 0 ?
                                (((post.likes || 0) + (post.comments || 0) + (post.shares || 0)) / post.impressions * 100).toFixed(2) : 0
                        }
                    });
                });
                if (response.data.pagination) {
                    this.pagination.total = response.data.pagination.total || 0;
                    this.pagination.totalPages = response.data.pagination.totalPages || 1;
                }
                this.metrics.totalPosts = this.posts.size;
            }
        } catch (error) { console.error('[Social] Posts load failed:', error); }
    }

    setupEventListeners() {
        EventBus.on('social:connect', this.connectPlatform.bind(this));
        EventBus.on('social:disconnect', this.disconnectPlatform.bind(this));
        EventBus.on('social:create-post', this.createPost.bind(this));
        EventBus.on('social:schedule-post', this.schedulePost.bind(this));
        EventBus.on('social:publish-now', this.publishNow.bind(this));
        EventBus.on('social:delete-post', this.deletePost.bind(this));
        EventBus.on('social:fetch-analytics', this.fetchAnalytics.bind(this));
        console.log('[Social] Event listeners initialized');
    }

    async connectPlatform(platform) {
        try {
            const platformConfig = this.platforms[platform];
            if (!platformConfig) throw new Error('Unknown platform');
            Toast.show(`Connecting to ${platformConfig.label}...`, 'info');

            const response = await API.get(`${this.apiEndpoint}/auth-url?platform=${platform}`);
            if (!response.success) throw new Error('Failed to get auth URL');

            const width = 600, height = 700;
            const left = (screen.width - width) / 2, top = (screen.height - height) / 2;
            const popup = window.open(response.data.url, 'SocialAuth',
                `width=${width},height=${height},left=${left},top=${top}`);

            const authResult = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Auth timeout')), 120000);
                window.addEventListener('message', (e) => {
                    if (e.data.type === 'social-auth-success') { clearTimeout(timeout); resolve(e.data); }
                    if (e.data.type === 'social-auth-error') { clearTimeout(timeout); reject(new Error(e.data.error)); }
                });
            });

            await API.post(`${this.apiEndpoint}/connect`, { platform, code: authResult.code });
            await this.loadConnectedAccounts();
            Toast.show(`${platformConfig.label} connected!`, 'success');
            EventBus.emit('social:connected', { platform });
        } catch (error) {
            console.error('[Social] Connection failed:', error);
            Toast.show('Connection failed: ' + error.message, 'error');
        }
    }

    async disconnectPlatform(accountId) {
        try {
            const account = this.connectedAccounts.get(accountId);
            if (!account) throw new Error('Account not found');
            const confirmed = await this.confirmDialog('Disconnect', `Disconnect ${account.platformInfo.label} account "${account.name}"?`);
            if (!confirmed) return;
            await API.delete(`${this.apiEndpoint}/accounts/${accountId}`);
            this.connectedAccounts.delete(accountId);
            Toast.show('Account disconnected', 'info');
        } catch (error) {
            console.error('[Social] Disconnect failed:', error);
            Toast.show('Failed to disconnect', 'error');
        }
    }

    async createPost(postData) {
        try {
            const content = postData.content || '';
            const platform = postData.platform;
            const platformConfig = this.platforms[platform];
            if (platformConfig && content.length > platformConfig.maxPostLength) {
                throw new Error(`Content exceeds ${platformConfig.maxPostLength} character limit for ${platformConfig.label}`);
            }

            const response = await API.post(`${this.apiEndpoint}/posts`, {
                ...postData,
                status: postData.scheduleAt ? 'scheduled' : 'draft',
                createdAt: new Date().toISOString()
            });

            if (!response.success) throw new Error(response.error);
            Toast.show(postData.scheduleAt ? 'Post scheduled!' : 'Post saved as draft', 'success');
            await this.loadPosts();
            return response.data;
        } catch (error) {
            console.error('[Social] Post creation failed:', error);
            Toast.show('Failed to create post: ' + error.message, 'error');
            return null;
        }
    }

    async schedulePost(postData) {
        if (!postData.scheduleAt) throw new Error('Schedule time required');
        const scheduleDate = new Date(postData.scheduleAt);
        if (scheduleDate <= new Date()) throw new Error('Schedule time must be in the future');
        return await this.createPost({ ...postData, scheduleAt: scheduleDate.toISOString() });
    }

    async publishNow(postId) {
        try {
            const post = this.posts.get(postId);
            if (!post) throw new Error('Post not found');
            Toast.show('Publishing...', 'info');

            const response = await API.post(`${this.apiEndpoint}/posts/${postId}/publish`);
            if (!response.success) throw new Error(response.error);

            post.status = 'published';
            post.statusInfo = this.postStatuses.published;
            post.publishedAt = new Date().toISOString();
            this.posts.set(postId, post);
            this.metrics.publishedPosts++;

            Toast.show(`Published on ${post.platformInfo?.label || 'platform'}!`, 'success');
            EventBus.emit('social:published', { postId, platform: post.platform });
            return response.data;
        } catch (error) {
            console.error('[Social] Publish failed:', error);
            Toast.show('Publish failed: ' + error.message, 'error');
            return null;
        }
    }

    async deletePost(postId) {
        try {
            const post = this.posts.get(postId);
            if (!post) throw new Error('Post not found');
            const confirmed = await this.confirmDialog('Delete Post', 'Delete this post permanently?');
            if (!confirmed) return;
            await API.delete(`${this.apiEndpoint}/posts/${postId}`);
            this.posts.delete(postId);
            Toast.show('Post deleted', 'info');
            await this.loadPosts();
        } catch (error) {
            console.error('[Social] Delete failed:', error);
            Toast.show('Failed to delete post', 'error');
        }
    }

    async fetchAnalytics(postId) {
        try {
            const response = await API.get(`${this.apiEndpoint}/analytics/${postId}`);
            if (response.success && response.data) {
                this.analytics.set(postId, response.data);
                const post = this.posts.get(postId);
                if (post) {
                    post.likes = response.data.likes || 0;
                    post.comments = response.data.comments || 0;
                    post.shares = response.data.shares || 0;
                    post.impressions = response.data.impressions || 0;
                    post.reach = response.data.reach || 0;
                    post.clicks = response.data.clicks || 0;
                    post.engagementRate = post.impressions > 0 ?
                        (((post.likes) + (post.comments) + (post.shares)) / post.impressions * 100).toFixed(2) : 0;
                    this.posts.set(postId, post);
                }
                return response.data;
            }
        } catch (error) { console.error('[Social] Analytics fetch failed:', error); return null; }
    }

    openPostComposer() {
        const platforms = Array.from(this.connectedAccounts.values());
        if (platforms.length === 0) {
            Toast.show('Connect a social media account first', 'warning');
            return;
        }

        const composerHtml = `
            <div class="social-composer">
                <form id="social-post-form">
                    <div class="form-row">
                        <div class="form-group col-6">
                            <label>Platform *</label>
                            <select name="platform" id="composer-platform" required onchange="window.Global.Social.updateComposerPreview()">
                                ${platforms.map(acc => `<option value="${acc.platform}">${acc.platformInfo.label} - ${acc.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group col-6">
                            <label>Content Type</label>
                            <select name="type" id="composer-type">
                                ${Object.entries(this.contentTypes).map(([key, type]) => `<option value="${key}">${type.label}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Content *</label>
                        <textarea name="content" id="composer-content" rows="6" required placeholder="What would you like to share?" oninput="window.Global.Social.updateCharCount()"></textarea>
                        <div class="char-counter"><span id="char-count">0</span>/<span id="char-limit">280</span></div>
                    </div>
                    <div class="form-group">
                        <label>Media URLs (one per line)</label>
                        <textarea name="mediaUrls" rows="2" placeholder="https://example.com/image.jpg"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Link URL</label>
                        <input type="url" name="linkUrl" placeholder="https://example.com">
                    </div>
                    <div class="form-row">
                        <div class="form-group col-6">
                            <label>Schedule (optional)</label>
                            <input type="datetime-local" name="scheduleAt">
                        </div>
                        <div class="form-group col-6">
                            <label>Hashtags</label>
                            <input type="text" name="hashtags" placeholder="#marketing #digital">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="window.Global.Modal.close()">Cancel</button>
                        <button type="button" class="btn btn-outline" id="save-draft-btn">Save Draft</button>
                        <button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Publish Now</button>
                    </div>
                </form>
            </div>
        `;

        const modal = new Modal({ title: 'Create Post', content: composerHtml, size: 'large' });
        modal.open();

        setTimeout(() => {
            const form = document.getElementById('social-post-form');
            const contentArea = document.getElementById('composer-content');
            const platformSelect = document.getElementById('composer-platform');
            const charLimit = document.getElementById('char-limit');
            const charCount = document.getElementById('char-count');

            const updateLimits = () => {
                const platform = platformSelect?.value;
                const limit = this.platforms[platform]?.maxPostLength || 280;
                if (charLimit) charLimit.textContent = limit;
            };

            platformSelect?.addEventListener('change', updateLimits);
            contentArea?.addEventListener('input', () => {
                if (charCount) charCount.textContent = contentArea.value.length;
            });

            form?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const postData = {
                    platform: formData.get('platform'),
                    type: formData.get('type'),
                    content: formData.get('content'),
                    mediaUrls: formData.get('mediaUrls').split('\n').filter(Boolean),
                    linkUrl: formData.get('linkUrl'),
                    hashtags: formData.get('hashtags').split(' ').filter(t => t.startsWith('#')),
                    scheduleAt: formData.get('scheduleAt') || undefined
                };
                const result = postData.scheduleAt ? await this.schedulePost(postData) : await this.createPost(postData);
                if (result) { Modal.close(); if (!postData.scheduleAt) await this.publishNow(result.id); }
            });

            updateLimits();
        }, 100);
    }

    calculateMetrics() {
        let totalEngagement = 0, totalReach = 0, totalImpressions = 0, publishedPosts = 0, scheduledPosts = 0;
        this.posts.forEach(post => {
            if (post.status === 'published') {
                publishedPosts++;
                totalEngagement += (post.likes || 0) + (post.comments || 0) + (post.shares || 0);
                totalReach += post.reach || 0;
                totalImpressions += post.impressions || 0;
            }
            if (post.status === 'scheduled') scheduledPosts++;
        });
        this.metrics.publishedPosts = publishedPosts;
        this.metrics.scheduledPosts = scheduledPosts;
        this.metrics.totalEngagement = totalEngagement;
        this.metrics.totalReach = totalReach;
        this.metrics.totalImpressions = totalImpressions;
        this.metrics.averageEngagementRate = totalImpressions > 0 ? ((totalEngagement / totalImpressions) * 100).toFixed(2) : 0;
        this.metrics.lastUpdated = new Date();
    }

    async render(container = null) {
        const target = container || document.getElementById('social-container');
        if (!target) return;
        const html = `
            <div class="social-container">
                <div class="social-header">
                    <h3><i class="fas fa-share-alt"></i> Social Media</h3>
                    <div class="header-actions">
                        <button class="btn btn-primary" onclick="window.Global.Social.openPostComposer()"><i class="fas fa-plus"></i> Create Post</button>
                    </div>
                </div>
                <div class="social-metrics">
                    <div class="metric-card"><span>${this.metrics.publishedPosts}</span><small>Published</small></div>
                    <div class="metric-card"><span>${this.metrics.scheduledPosts}</span><small>Scheduled</small></div>
                    <div class="metric-card"><span>${this.metrics.totalEngagement.toLocaleString()}</span><small>Engagement</small></div>
                    <div class="metric-card"><span>${this.metrics.totalReach.toLocaleString()}</span><small>Reach</small></div>
                    <div class="metric-card"><span>${this.metrics.averageEngagementRate}%</span><small>Eng. Rate</small></div>
                </div>
                <div class="connected-accounts">
                    <h4>Connected Accounts</h4>
                    <div class="accounts-list">
                        ${Array.from(this.connectedAccounts.values()).map(acc => `
                            <div class="account-item" style="border-left:3px solid ${acc.platformInfo.color}">
                                <i class="fab ${acc.platformInfo.icon}" style="color:${acc.platformInfo.color}"></i>
                                <span>${this.escapeHtml(acc.name)}</span>
                                <span class="status ${acc.isTokenValid ? 'active' : 'expired'}">${acc.isTokenValid ? 'Active' : 'Expired'}</span>
                            </div>
                        `).join('') || '<p>No accounts connected</p>'}
                        <button class="btn btn-outline" onclick="window.Global.Social.showConnectMenu()"><i class="fas fa-plus"></i> Connect Account</button>
                    </div>
                </div>
                <div class="posts-list">
                    <h4>Recent Posts</h4>
                    ${Array.from(this.posts.values()).slice(0, 10).map(post => `
                        <div class="post-item">
                            <span class="status-badge" style="background:${post.statusInfo.color}20;color:${post.statusInfo.color}">${post.statusInfo.label}</span>
                            <span><i class="fab ${post.platformInfo.icon}"></i> ${post.platformInfo.label}</span>
                            <span>${this.escapeHtml(post.content?.substring(0, 80) || '')}...</span>
                            <span>${post.formattedDate}</span>
                        </div>
                    `).join('') || '<p>No posts yet</p>'}
                </div>
            </div>`;
        target.innerHTML = html;
    }

    showConnectMenu() {
        const html = Object.entries(this.platforms).map(([key, p]) => `
            <button class="btn btn-outline btn-block" onclick="window.Global.Social.connectPlatform('${key}');window.Global.Modal.close();">
                <i class="fab ${p.icon}" style="color:${p.color}"></i> Connect ${p.label}
            </button>
        `).join('');
        new Modal({ title: 'Connect Social Account', content: html, size: 'small' }).open();
    }

    confirmDialog(title, message) {
        return new Promise(resolve => {
            const modal = new Modal({ title, content: `<p>${message}</p><div class="modal-actions"><button class="btn btn-secondary cancel-btn">Cancel</button><button class="btn btn-primary confirm-btn">Confirm</button></div>`, size: 'small', onClose: () => resolve(false) });
            modal.open();
            setTimeout(() => {
                document.querySelector('.cancel-btn')?.addEventListener('click', () => { modal.close(); resolve(false); });
                document.querySelector('.confirm-btn')?.addEventListener('click', () => { modal.close(); resolve(true); });
            }, 100);
        });
    }

    escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = String(text); return div.innerHTML; }

    destroy() {
        EventBus.off('social:connect'); EventBus.off('social:disconnect'); EventBus.off('social:create-post');
        EventBus.off('social:schedule-post'); EventBus.off('social:publish-now'); EventBus.off('social:delete-post');
        console.log('[Social] Module destroyed');
    }
}

const socialIntegration = new SocialIntegration();
export { socialIntegration, SocialIntegration };
export default socialIntegration;
if (typeof window !== 'undefined') { window.Global = window.Global || {}; window.Global.Social = socialIntegration; }
<<<<<<< HEAD

=======
>>>>>>> 8f1d8beec953e283a49ae0dfcde747a14c5c459a
