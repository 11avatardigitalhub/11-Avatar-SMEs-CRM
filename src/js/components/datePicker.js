/**
 * 11 AVATAR DIGITAL HUB - Date Picker Component
 * Enterprise-grade reusable date/time picker with range selection
 * Single date, date range, time picker, calendar view, localization
 * 
 * @component DatePicker
 * @version 2.0.0
 * @author 11 Avatar Digital Hub
 * @license GPL-3.0
 */

import { EventBus } from '../core/eventBus.js';
import { Formatters } from '../utils/formatters.js';

/**
 * DatePicker - Universal date/time selection component
 * Supports single date, range, time, month, year, multi-calendar
 */
class DatePicker {
    constructor(container, options = {}) {
        this.componentName = 'DatePicker';
        this.componentId = `dp-${Date.now().toString(36)}`;
        
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        if (!this.container) throw new Error('DatePicker: Container not found');

        this.config = {
            mode: options.mode || 'single',
            value: options.value || null,
            startDate: options.startDate || null,
            endDate: options.endDate || null,
            minDate: options.minDate || null,
            maxDate: options.maxDate || null,
            disabledDates: options.disabledDates || [],
            disabledDays: options.disabledDays || [],
            allowedDays: options.allowedDays || [],
            format: options.format || 'DD/MM/YYYY',
            displayFormat: options.displayFormat || 'DD MMM YYYY',
            timeFormat: options.timeFormat || '12h',
            enableTime: options.enableTime || false,
            timeInterval: options.timeInterval || 30,
            placeholder: options.placeholder || 'Select date...',
            rangePlaceholder: options.rangePlaceholder || ['Start date', 'End date'],
            showWeekNumbers: options.showWeekNumbers || false,
            weekStartDay: options.weekStartDay || 0,
            firstDayOfWeek: options.firstDayOfWeek || 0,
            numberOfMonths: options.numberOfMonths || 1,
            showMonthYearPicker: options.showMonthYearPicker || false,
            showYearPicker: options.showYearPicker || false,
            closeOnSelect: options.closeOnSelect !== false,
            autoClose: options.autoClose || false,
            inline: options.inline || false,
            position: options.position || 'bottom-left',
            offset: options.offset || 0,
            locale: options.locale || 'en-IN',
            theme: options.theme || 'light',
            clearable: options.clearable !== false,
            todayHighlight: options.todayHighlight !== false,
            showTodayButton: options.showTodayButton || false,
            showClearButton: options.showClearButton || false,
            readOnly: options.readOnly || false,
            disabled: options.disabled || false,
            required: options.required || false,
            name: options.name || '',
            className: options.className || '',
            onChange: options.onChange || null,
            onOpen: options.onOpen || null,
            onClose: options.onClose || null,
            onSelect: options.onSelect || null,
            onMonthChange: options.onMonthChange || null,
            onYearChange: options.onYearChange || null
        };

        this.state = {
            isOpen: false,
            currentDate: new Date(),
            currentMonth: new Date().getMonth(),
            currentYear: new Date().getFullYear(),
            selectedDate: this.config.value ? this.parseDate(this.config.value) : null,
            startDate: this.config.startDate ? this.parseDate(this.config.startDate) : null,
            endDate: this.config.endDate ? this.parseDate(this.config.endDate) : null,
            hoverDate: null,
            view: 'calendar',
            timeValue: '09:00',
            isSelectingRange: false,
            rangeSelectionStart: null
        };

        this.elements = {
            wrapper: null, input: null, calendar: null,
            trigger: null, clearBtn: null, timePicker: null
        };

        this.monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        this.monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        this.dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        this.dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        this.dayNamesMin = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

        this.init();
    }

    init() {
        try {
            console.log(`[DatePicker] Initializing: ${this.componentId}`);
            this.render();
            this.setupEventHandlers();
            if (this.config.inline) this.open();
            console.log('[DatePicker] Initialized');
        } catch (error) {
            console.error('[DatePicker] Init failed:', error);
        }
    }

    render() {
        const value = this.formatDisplayValue();
        
        const html = `
            <div class="datepicker-wrapper ${this.config.className} ${this.config.theme} ${this.config.inline ? 'inline' : ''}" 
                 id="${this.componentId}">
                ${!this.config.inline ? `
                    <div class="datepicker-input-group">
                        <input type="text" 
                               class="datepicker-input" 
                               id="${this.componentId}-input"
                               value="${this.escapeHtml(value)}"
                               placeholder="${this.config.placeholder}"
                               readonly="${this.config.readOnly}"
                               disabled="${this.config.disabled}"
                               ${this.config.required ? 'required' : ''}
                               name="${this.config.name}"
                               aria-label="Date picker"
                               autocomplete="off">
                        <div class="datepicker-input-actions">
                            ${this.config.clearable && (this.state.selectedDate || this.state.startDate) ? `
                                <button class="datepicker-clear-btn" id="${this.componentId}-clear" 
                                        aria-label="Clear date" tabindex="-1">
                                    <i class="fas fa-times"></i>
                                </button>
                            ` : ''}
                            <button class="datepicker-trigger" id="${this.componentId}-trigger" 
                                    aria-label="Open calendar" tabindex="-1">
                                <i class="fas fa-calendar-alt"></i>
                            </button>
                        </div>
                    </div>
                ` : ''}
                
                <div class="datepicker-calendar ${this.state.isOpen || this.config.inline ? 'open' : ''}" 
                     id="${this.componentId}-calendar"
                     style="position: ${this.config.inline ? 'relative' : 'absolute'};">
                    ${this.renderCalendar()}
                    ${this.config.enableTime ? this.renderTimePicker() : ''}
                    ${this.renderCalendarFooter()}
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.cacheElements();
    }

    renderCalendar() {
        const { currentMonth, currentYear } = this.state;
        
        return `
            <div class="datepicker-calendar-container">
                <div class="datepicker-header">
                    <button class="datepicker-nav prev-month" id="${this.componentId}-prev-month" 
                            aria-label="Previous month">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    
                    <div class="datepicker-month-year">
                        <button class="datepicker-month-btn" id="${this.componentId}-month-btn">
                            ${this.monthNames[currentMonth]}
                        </button>
                        <button class="datepicker-year-btn" id="${this.componentId}-year-btn">
                            ${currentYear}
                        </button>
                    </div>
                    
                    <button class="datepicker-nav next-month" id="${this.componentId}-next-month" 
                            aria-label="Next month">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>

                ${this.state.view === 'calendar' ? this.renderMonthView() : ''}
                ${this.state.view === 'month' ? this.renderMonthPicker() : ''}
                ${this.state.view === 'year' ? this.renderYearPicker() : ''}
            </div>
        `;
    }

    renderMonthView() {
        const { currentMonth, currentYear, selectedDate, startDate, endDate, hoverDate } = this.state;
        const today = new Date();
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
        
        const startDay = (firstDay - this.config.firstDayOfWeek + 7) % 7;
        
        let html = `
            <div class="datepicker-days">
                ${this.renderDayHeaders()}
                <div class="datepicker-days-grid">
        `;

        if (this.config.showWeekNumbers) {
            html += '<div class="datepicker-week-numbers">';
            for (let w = 0; w < 6; w++) {
                const weekDate = new Date(currentYear, currentMonth, 1 + w * 7 - startDay);
                html += `<span class="week-number">${this.getWeekNumber(weekDate)}</span>`;
            }
            html += '</div>';
        }

        html += '<div class="datepicker-dates">';

        for (let i = startDay - 1; i >= 0; i--) {
            const day = prevMonthDays - i;
            html += this.renderDay(day, currentMonth - 1, currentYear, true);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            html += this.renderDay(day, currentMonth, currentYear, false);
        }

        const remainingCells = 42 - (startDay + daysInMonth);
        for (let day = 1; day <= remainingCells; day++) {
            html += this.renderDay(day, currentMonth + 1, currentYear, true);
        }

        html += '</div></div></div>';
        return html;
    }

    renderDay(day, month, year, isOtherMonth) {
        const date = new Date(year, month, day);
        const dateStr = this.formatDateISO(date);
        const today = new Date();
        const isToday = this.isSameDay(date, today);
        const isSelected = this.state.selectedDate && this.isSameDay(date, this.state.selectedDate);
        const isStart = this.state.startDate && this.isSameDay(date, this.state.startDate);
        const isEnd = this.state.endDate && this.isSameDay(date, this.state.endDate);
        const isInRange = this.isInRange(date);
        const isHovered = this.state.hoverDate && this.isSameDay(date, this.state.hoverDate);
        const isDisabled = this.isDateDisabled(date);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;

        let classes = 'datepicker-day';
        if (isOtherMonth) classes += ' other-month';
        if (isToday) classes += ' today';
        if (isSelected) classes += ' selected';
        if (isStart) classes += ' range-start';
        if (isEnd) classes += ' range-end';
        if (isInRange) classes += ' in-range';
        if (isHovered) classes += ' hovered';
        if (isDisabled) classes += ' disabled';
        if (isWeekend) classes += ' weekend';

        return `
            <button class="${classes}" 
                    data-date="${dateStr}"
                    ${isDisabled ? 'disabled' : ''}
                    aria-label="${this.dayNames[date.getDay()]}, ${day} ${this.monthNames[month]} ${year}"
                    aria-selected="${isSelected}">
                ${day}
                ${isToday && this.config.todayHighlight ? '<span class="today-dot"></span>' : ''}
            </button>
        `;
    }

    renderDayHeaders() {
        let headers = '';
        for (let i = 0; i < 7; i++) {
            const dayIndex = (i + this.config.firstDayOfWeek) % 7;
            headers += `<span class="datepicker-day-header">${this.dayNamesMin[dayIndex]}</span>`;
        }
        return `<div class="datepicker-day-headers">${headers}</div>`;
    }

    renderMonthPicker() {
        let html = '<div class="datepicker-month-picker">';
        for (let m = 0; m < 12; m++) {
            const isSelected = m === this.state.currentMonth;
            const isCurrentMonth = m === new Date().getMonth() && this.state.currentYear === new Date().getFullYear();
            html += `
                <button class="datepicker-month ${isSelected ? 'selected' : ''} ${isCurrentMonth ? 'current' : ''}"
                        data-month="${m}" aria-label="${this.monthNames[m]}">
                    ${this.monthNamesShort[m]}
                </button>
            `;
        }
        html += '</div>';
        return html;
    }

    renderYearPicker() {
        const currentYear = this.state.currentYear;
        const startYear = Math.floor(currentYear / 12) * 12;
        
        let html = '<div class="datepicker-year-picker">';
        html += `
            <button class="datepicker-nav prev-years" id="${this.componentId}-prev-years" aria-label="Previous 12 years">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        html += '<div class="datepicker-years-grid">';
        for (let y = startYear - 1; y < startYear + 11; y++) {
            const isSelected = y === this.state.currentYear;
            const isCurrentYear = y === new Date().getFullYear();
            html += `
                <button class="datepicker-year ${isSelected ? 'selected' : ''} ${isCurrentYear ? 'current' : ''} ${y < startYear || y >= startYear + 10 ? 'other-decade' : ''}"
                        data-year="${y}" aria-label="${y}">
                    ${y}
                </button>
            `;
        }
        html += '</div>';
        
        html += `
            <button class="datepicker-nav next-years" id="${this.componentId}-next-years" aria-label="Next 12 years">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        html += '</div>';
        return html;
    }

    renderTimePicker() {
        const hours = [];
        const is12h = this.config.timeFormat === '12h';
        
        for (let h = 0; h < 24; h += this.config.timeInterval / 60 || 1) {
            const displayHour = is12h ? (h % 12 || 12) : String(h).padStart(2, '0');
            const ampm = h < 12 ? 'AM' : 'PM';
            hours.push({
                value: String(h).padStart(2, '0'),
                display: is12h ? `${displayHour}:00 ${ampm}` : `${displayHour}:00`
            });
        }

        return `
            <div class="datepicker-time-picker">
                <div class="time-picker-header">
                    <i class="fas fa-clock"></i> Time
                </div>
                <div class="time-picker-inputs">
                    <input type="number" class="time-input hour-input" id="${this.componentId}-hour" 
                           min="0" max="23" placeholder="HH" aria-label="Hours">
                    <span class="time-separator">:</span>
                    <input type="number" class="time-input minute-input" id="${this.componentId}-minute" 
                           min="0" max="59" step="${this.config.timeInterval}" placeholder="MM" aria-label="Minutes">
                    ${is12h ? `
                        <select class="time-ampm" id="${this.componentId}-ampm" aria-label="AM/PM">
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                        </select>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderCalendarFooter() {
        return `
            <div class="datepicker-footer">
                ${this.config.showTodayButton ? `
                    <button class="datepicker-today-btn" id="${this.componentId}-today">
                        Today
                    </button>
                ` : ''}
                ${this.config.showClearButton ? `
                    <button class="datepicker-clear-btn" id="${this.componentId}-clear-all">
                        Clear
                    </button>
                ` : ''}
                ${!this.config.inline ? `
                    <button class="datepicker-close-btn" id="${this.componentId}-close">
                        Close
                    </button>
                ` : ''}
            </div>
        `;
    }

    cacheElements() {
        this.elements.wrapper = document.getElementById(this.componentId);
        this.elements.input = document.getElementById(`${this.componentId}-input`);
        this.elements.calendar = document.getElementById(`${this.componentId}-calendar`);
        this.elements.trigger = document.getElementById(`${this.componentId}-trigger`);
        this.elements.clearBtn = document.getElementById(`${this.componentId}-clear`);
    }

    setupEventHandlers() {
        try {
            if (this.elements.trigger) {
                this.elements.trigger.addEventListener('click', () => this.toggle());
            }

            if (this.elements.input && !this.config.readOnly) {
                this.elements.input.addEventListener('click', () => this.open());
                this.elements.input.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') this.close();
                    if (e.key === 'Tab') this.close();
                });
            }

            if (this.elements.clearBtn) {
                this.elements.clearBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.clear();
                });
            }

            const calendar = this.elements.calendar;
            if (calendar) {
                calendar.addEventListener('click', (e) => {
                    const dayBtn = e.target.closest('.datepicker-day');
                    const monthBtn = e.target.closest('.datepicker-month');
                    const yearBtn = e.target.closest('.datepicker-year');
                    const prevMonth = e.target.closest('.prev-month');
                    const nextMonth = e.target.closest('.next-month');
                    const prevYears = e.target.closest('.prev-years');
                    const nextYears = e.target.closest('.next-years');
                    const monthBtn2 = e.target.closest('#dp-month-btn') || e.target.closest('.datepicker-month-btn');
                    const yearBtn2 = e.target.closest('#dp-year-btn') || e.target.closest('.datepicker-year-btn');
                    const todayBtn = e.target.closest('.datepicker-today-btn');
                    const clearAllBtn = e.target.closest('.datepicker-clear-btn');
                    const closeBtn = e.target.closest('.datepicker-close-btn');

                    if (dayBtn && !dayBtn.disabled) {
                        this.selectDate(dayBtn.dataset.date);
                    } else if (monthBtn) {
                        this.selectMonth(parseInt(monthBtn.dataset.month));
                    } else if (yearBtn) {
                        this.selectYear(parseInt(yearBtn.dataset.year));
                    } else if (prevMonth) {
                        this.navigateMonth(-1);
                    } else if (nextMonth) {
                        this.navigateMonth(1);
                    } else if (prevYears) {
                        this.navigateYears(-12);
                    } else if (nextYears) {
                        this.navigateYears(12);
                    } else if (monthBtn2) {
                        this.switchView('month');
                    } else if (yearBtn2) {
                        this.switchView('year');
                    } else if (todayBtn) {
                        this.selectToday();
                    } else if (clearAllBtn) {
                        this.clear();
                    } else if (closeBtn) {
                        this.close();
                    }
                });

                calendar.addEventListener('mouseover', (e) => {
                    if (this.config.mode === 'range' && this.state.isSelectingRange) {
                        const dayBtn = e.target.closest('.datepicker-day');
                        if (dayBtn) {
                            this.state.hoverDate = new Date(dayBtn.dataset.date);
                            this.updateCalendar();
                        }
                    }
                });
            }

            document.addEventListener('click', (e) => {
                if (this.state.isOpen && !this.config.inline &&
                    !this.container.contains(e.target)) {
                    this.close();
                }
            });

            document.addEventListener('keydown', (e) => {
                if (!this.state.isOpen) return;
                
                switch (e.key) {
                    case 'Escape': e.preventDefault(); this.close(); break;
                    case 'ArrowLeft': e.preventDefault(); this.navigateMonth(-1); break;
                    case 'ArrowRight': e.preventDefault(); this.navigateMonth(1); break;
                    case 'ArrowUp': e.preventDefault(); this.navigateMonth(0, -7); break;
                    case 'ArrowDown': e.preventDefault(); this.navigateMonth(0, 7); break;
                }
            });

            const todayBtn = document.getElementById(`${this.componentId}-today`);
            if (todayBtn) todayBtn.addEventListener('click', () => this.selectToday());

            console.log('[DatePicker] Event handlers set up');
        } catch (error) {
            console.error('[DatePicker] Event setup failed:', error);
        }
    }

    selectDate(dateStr) {
        const date = new Date(dateStr);
        
        switch (this.config.mode) {
            case 'single':
                this.state.selectedDate = date;
                if (this.config.closeOnSelect) this.close();
                if (this.config.onSelect) this.config.onSelect(date, this.formatDate(date));
                if (this.config.onChange) this.config.onChange(this.formatDate(date));
                break;

            case 'range':
                if (!this.state.isSelectingRange || this.state.rangeSelectionStart === null) {
                    this.state.rangeSelectionStart = date;
                    this.state.startDate = date;
                    this.state.endDate = null;
                    this.state.isSelectingRange = true;
                } else {
                    if (date < this.state.rangeSelectionStart) {
                        this.state.startDate = date;
                        this.state.endDate = this.state.rangeSelectionStart;
                    } else {
                        this.state.startDate = this.state.rangeSelectionStart;
                        this.state.endDate = date;
                    }
                    this.state.isSelectingRange = false;
                    this.state.rangeSelectionStart = null;
                    this.state.hoverDate = null;
                    
                    if (this.config.closeOnSelect) this.close();
                    if (this.config.onSelect) {
                        this.config.onSelect(
                            { start: this.state.startDate, end: this.state.endDate },
                            { start: this.formatDate(this.state.startDate), end: this.formatDate(this.state.endDate) }
                        );
                    }
                    if (this.config.onChange) {
                        this.config.onChange({
                            start: this.formatDate(this.state.startDate),
                            end: this.formatDate(this.state.endDate)
                        });
                    }
                }
                break;

            case 'multiple':
                if (!this.state.selectedDates) this.state.selectedDates = [];
                const index = this.state.selectedDates.findIndex(d => this.isSameDay(d, date));
                if (index > -1) {
                    this.state.selectedDates.splice(index, 1);
                } else {
                    this.state.selectedDates.push(date);
                }
                break;
        }

        this.updateInput();
        this.updateCalendar();
    }

    selectMonth(month) {
        this.state.currentMonth = month;
        this.state.view = 'calendar';
        this.updateCalendar();
        if (this.config.onMonthChange) this.config.onMonthChange(month);
    }

    selectYear(year) {
        this.state.currentYear = year;
        this.state.view = this.config.showMonthYearPicker ? 'month' : 'calendar';
        this.updateCalendar();
        if (this.config.onYearChange) this.config.onYearChange(year);
    }

    navigateMonth(months, days = 0) {
        if (days !== 0) {
            const newDate = new Date(this.state.currentYear, this.state.currentMonth, 1);
            newDate.setDate(newDate.getDate() + days);
            this.state.currentMonth = newDate.getMonth();
            this.state.currentYear = newDate.getFullYear();
        } else {
            this.state.currentMonth += months;
            if (this.state.currentMonth > 11) {
                this.state.currentMonth = 0;
                this.state.currentYear++;
            } else if (this.state.currentMonth < 0) {
                this.state.currentMonth = 11;
                this.state.currentYear--;
            }
        }
        this.updateCalendar();
    }

    navigateYears(years) {
        this.state.currentYear += years;
        this.updateCalendar();
    }

    switchView(view) {
        this.state.view = view;
        this.updateCalendar();
    }

    selectToday() {
        this.selectDate(new Date().toISOString().split('T')[0]);
    }

    clear() {
        this.state.selectedDate = null;
        this.state.startDate = null;
        this.state.endDate = null;
        this.state.isSelectingRange = false;
        this.state.rangeSelectionStart = null;
        this.updateInput();
        this.updateCalendar();
        if (this.config.onChange) this.config.onChange(null);
    }

    open() {
        if (this.config.disabled || this.state.isOpen) return;
        this.state.isOpen = true;
        
        if (this.state.selectedDate) {
            this.state.currentMonth = this.state.selectedDate.getMonth();
            this.state.currentYear = this.state.selectedDate.getFullYear();
        }
        
        this.updateCalendar();
        this.positionCalendar();
        
        if (this.config.onOpen) this.config.onOpen();
        
        setTimeout(() => {
            if (this.elements.calendar) {
                const selected = this.elements.calendar.querySelector('.datepicker-day.selected');
                if (selected) selected.focus();
            }
        }, 100);
    }

    close() {
        if (!this.state.isOpen) return;
        this.state.isOpen = false;
        this.updateCalendar();
        if (this.config.onClose) this.config.onClose();
    }

    toggle() {
        if (this.state.isOpen) this.close();
        else this.open();
    }

    positionCalendar() {
        if (this.config.inline || !this.elements.calendar) return;
        
        const inputRect = this.elements.input?.getBoundingClientRect();
        if (!inputRect) return;

        const calendar = this.elements.calendar;
        calendar.style.position = 'fixed';
        
        switch (this.config.position) {
            case 'bottom-left':
                calendar.style.top = `${inputRect.bottom + this.config.offset}px`;
                calendar.style.left = `${inputRect.left}px`;
                break;
            case 'bottom-right':
                calendar.style.top = `${inputRect.bottom + this.config.offset}px`;
                calendar.style.right = `${window.innerWidth - inputRect.right}px`;
                break;
            case 'top-left':
                calendar.style.top = `${inputRect.top - calendar.offsetHeight - this.config.offset}px`;
                calendar.style.left = `${inputRect.left}px`;
                break;
            case 'top-right':
                calendar.style.top = `${inputRect.top - calendar.offsetHeight - this.config.offset}px`;
                calendar.style.right = `${window.innerWidth - inputRect.right}px`;
                break;
        }

        if (calendar.getBoundingClientRect().bottom > window.innerHeight) {
            calendar.style.top = `${inputRect.top - calendar.offsetHeight - this.config.offset}px`;
        }
    }

    updateInput() {
        if (!this.elements.input) return;
        this.elements.input.value = this.formatDisplayValue();
    }

    updateCalendar() {
        if (this.elements.calendar) {
            const calendarContainer = this.elements.calendar.querySelector('.datepicker-calendar-container');
            if (calendarContainer) {
                calendarContainer.innerHTML = this.renderCalendar().split('datepicker-calendar-container">')[1].split('</div>')[0];
            }
        }
        this.setupEventHandlers();
    }

    formatDisplayValue() {
        switch (this.config.mode) {
            case 'single':
                return this.state.selectedDate ? this.formatDate(this.state.selectedDate) : '';
            case 'range':
                if (this.state.startDate && this.state.endDate) {
                    return `${this.formatDate(this.state.startDate)} - ${this.formatDate(this.state.endDate)}`;
                }
                if (this.state.startDate) return `${this.formatDate(this.state.startDate)} - `;
                return '';
            default:
                return '';
        }
    }

    formatDate(date) {
        if (!date) return '';
        return Formatters.date(date, this.config.displayFormat);
    }

    formatDateISO(date) {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    parseDate(dateStr) {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    }

    isSameDay(d1, d2) {
        if (!d1 || !d2) return false;
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    }

    isInRange(date) {
        if (!this.state.startDate && !this.state.endDate) return false;
        if (this.state.startDate && this.state.endDate) {
            return date > this.state.startDate && date < this.state.endDate;
        }
        if (this.state.isSelectingRange && this.state.rangeSelectionStart && this.state.hoverDate) {
            const start = this.state.rangeSelectionStart < this.state.hoverDate ? 
                this.state.rangeSelectionStart : this.state.hoverDate;
            const end = this.state.rangeSelectionStart < this.state.hoverDate ? 
                this.state.hoverDate : this.state.rangeSelectionStart;
            return date > start && date < end;
        }
        return false;
    }

    isDateDisabled(date) {
        if (this.config.minDate && date < new Date(this.config.minDate)) return true;
        if (this.config.maxDate && date > new Date(this.config.maxDate)) return true;
        if (this.config.disabledDates.some(d => this.isSameDay(date, new Date(d)))) return true;
        if (this.config.disabledDays.includes(date.getDay())) return true;
        if (this.config.allowedDays.length > 0 && !this.config.allowedDays.includes(date.getDay())) return true;
        return false;
    }

    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    getValue() {
        switch (this.config.mode) {
            case 'single':
                return this.state.selectedDate ? this.formatDateISO(this.state.selectedDate) : null;
            case 'range':
                return {
                    start: this.state.startDate ? this.formatDateISO(this.state.startDate) : null,
                    end: this.state.endDate ? this.formatDateISO(this.state.endDate) : null
                };
            default:
                return null;
        }
    }

    setValue(value) {
        if (this.config.mode === 'single') {
            this.state.selectedDate = this.parseDate(value);
        } else if (this.config.mode === 'range' && value) {
            this.state.startDate = this.parseDate(value.start);
            this.state.endDate = this.parseDate(value.end);
        }
        this.updateInput();
        this.updateCalendar();
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    destroy() {
        this.close();
        if (this.container) this.container.innerHTML = '';
        console.log('[DatePicker] Component destroyed');
    }

    static getInstance(componentId) {
        return window.Global?.DatePicker?.instances?.get(componentId);
    }
}

export { DatePicker };
export default DatePicker;

if (typeof window !== 'undefined') {
    window.Global = window.Global || {};
    window.Global.DatePicker = window.Global.DatePicker || {};
    window.Global.DatePicker.instances = window.Global.DatePicker.instances || new Map();
    window.Global.DatePicker.DatePicker = DatePicker;
}
