// Data management
const ChickenTracker = {
  data: {
    incubations: [],
    medications: [],
    feedings: []
  },
  
  async init() {
    // Only initialize if user is logged in
    if (!AuthManager.isLoggedIn) return;
  
    await this.loadData();
    this.setupEventListeners();
    this.setupSubscriptions();
    this.updateDashboard();
    this.renderIncubationList();
    this.renderMedicationList();
    this.renderFeedingList();
    this.calculateFeedSummary();
    this.initCalendar();
    
    // Check for today's tasks on load
    this.checkTodayTasks();
    
    // Set up interval to check for tasks every hour
    setInterval(() => this.checkTodayTasks(), 3600000);
  },
  
  async loadData() {
    // User-specific data using their ID
    const userId = AuthManager.currentUser.id;
    
    try {
      this.data.incubations = await dbManager.getIncubations(userId);
      this.data.medications = await dbManager.getMedications(userId);
      this.data.feedings = await dbManager.getFeedings(userId);
    } catch (error) {
      console.error("Error loading data:", error);
      this.showNotification("Error loading data. Please try refreshing the page.");
    }
  },
  
  setupSubscriptions() {
    const userId = AuthManager.currentUser.id;
    
    // Subscribe to incubations changes
    dbManager.room.collection('incubations').filter({userId: userId}).subscribe((incubations) => {
      this.data.incubations = incubations.map(inc => ({
        ...inc,
        startDate: new Date(inc.startDate),
        hatchDate: new Date(inc.hatchDate)
      }));
      this.renderIncubationList();
      this.updateDashboard();
      this.renderCalendar();
    });
    
    // Subscribe to medications changes
    dbManager.room.collection('medications').filter({userId: userId}).subscribe((medications) => {
      this.data.medications = medications.map(med => ({
        ...med,
        dateGiven: new Date(med.dateGiven),
        nextSchedule: med.nextSchedule ? new Date(med.nextSchedule) : null
      }));
      this.renderMedicationList();
      this.updateDashboard();
      this.renderCalendar();
    });
    
    // Subscribe to feedings changes
    dbManager.room.collection('feedings').filter({userId: userId}).subscribe((feedings) => {
      this.data.feedings = feedings.map(feed => ({
        ...feed,
        date: new Date(feed.date)
      }));
      this.renderFeedingList();
      this.calculateFeedSummary();
      this.renderCalendar();
    });
  },
  
  // Incubation functions
  async addIncubation() {
    const batchName = document.getElementById('batch-name').value;
    const startDate = new Date(document.getElementById('start-date').value);
    const eggCount = parseInt(document.getElementById('egg-count').value);
    const breed = document.getElementById('breed').value;
    
    // Calculate hatch date (21 days)
    const hatchDate = new Date(startDate);
    hatchDate.setDate(hatchDate.getDate() + 21);
    
    const newIncubation = {
      userId: AuthManager.currentUser.id,
      batchName,
      startDate: startDate.toISOString(),
      hatchDate: hatchDate.toISOString(),
      eggCount,
      breed,
      status: 'active'
    };
    
    try {
      await dbManager.createIncubation(newIncubation);
      this.showNotification(`Incubation "${batchName}" added successfully!`);
      document.getElementById('incubation-form').reset();
    } catch (error) {
      console.error("Error adding incubation:", error);
      this.showNotification("Error adding incubation. Please try again.");
    }
  },
  
  async deleteIncubation(id) {
    try {
      await dbManager.deleteIncubation(id);
      this.showNotification('Incubation deleted');
    } catch (error) {
      console.error("Error deleting incubation:", error);
      this.showNotification("Error deleting incubation. Please try again.");
    }
  },
  
  async completeIncubation(id) {
    const incubation = this.data.incubations.find(inc => inc.id === id);
    if (incubation) {
      try {
        await dbManager.updateIncubation(id, { status: 'completed' });
        this.showNotification(`Incubation "${incubation.batchName}" marked as completed!`);
      } catch (error) {
        console.error("Error completing incubation:", error);
        this.showNotification("Error marking incubation as complete. Please try again.");
      }
    }
  },
  
  // Medication functions
  async addMedication() {
    const name = document.getElementById('medication-name').value;
    const dateGiven = new Date(document.getElementById('medication-date').value);
    const notes = document.getElementById('medication-notes').value;
    const nextScheduleInput = document.getElementById('next-schedule').value;
    const nextSchedule = nextScheduleInput ? new Date(nextScheduleInput) : null;
    
    const newMedication = {
      userId: AuthManager.currentUser.id,
      name,
      dateGiven: dateGiven.toISOString(),
      notes,
      nextSchedule: nextSchedule ? nextSchedule.toISOString() : null
    };
    
    try {
      await dbManager.createMedication(newMedication);
      this.showNotification(`Medication "${name}" added successfully!`);
      document.getElementById('medication-form').reset();
    } catch (error) {
      console.error("Error adding medication:", error);
      this.showNotification("Error adding medication. Please try again.");
    }
  },
  
  async deleteMedication(id) {
    try {
      await dbManager.deleteMedication(id);
      this.showNotification('Medication record deleted');
    } catch (error) {
      console.error("Error deleting medication:", error);
      this.showNotification("Error deleting medication. Please try again.");
    }
  },
  
  // Feeding functions
  async addFeeding() {
    const date = new Date(document.getElementById('feed-date').value);
    const feedType = document.getElementById('feed-type').value;
    const amount = parseFloat(document.getElementById('feed-amount').value);
    const notes = document.getElementById('feed-notes').value;
    
    const newFeeding = {
      userId: AuthManager.currentUser.id,
      date: date.toISOString(),
      feedType,
      amount,
      notes
    };
    
    try {
      await dbManager.createFeeding(newFeeding);
      this.showNotification(`Feeding record added successfully!`);
      document.getElementById('feeding-form').reset();
    } catch (error) {
      console.error("Error adding feeding:", error);
      this.showNotification("Error adding feeding record. Please try again.");
    }
  },
  
  async deleteFeeding(id) {
    try {
      await dbManager.deleteFeeding(id);
      this.showNotification('Feeding record deleted');
    } catch (error) {
      console.error("Error deleting feeding:", error);
      this.showNotification("Error deleting feeding record. Please try again.");
    }
  },
  
  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchView(btn.dataset.view);
      });
    });
    
    // Dashboard quick actions
    document.getElementById('add-incubation-btn').addEventListener('click', () => {
      this.switchView('incubation');
    });
    
    document.getElementById('add-medication-btn').addEventListener('click', () => {
      this.switchView('medication');
    });
    
    // Form submissions
    document.getElementById('incubation-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addIncubation();
    });
    
    document.getElementById('medication-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addMedication();
    });
    
    document.getElementById('feeding-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addFeeding();
    });
    
    // Calendar navigation
    document.getElementById('prev-month').addEventListener('click', () => {
      this.prevMonth();
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
      this.nextMonth();
    });
    
    // Close notification
    document.getElementById('close-notification').addEventListener('click', () => {
      document.getElementById('notification').classList.remove('show');
    });
  },
  
  switchView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    document.getElementById(viewId).classList.add('active');
    document.querySelector(`.nav-btn[data-view="${viewId}"]`).classList.add('active');
  },
  
  // Incubation list
  renderIncubationList() {
    const incubationList = document.getElementById('incubation-list');
    const historyList = document.getElementById('incubation-history');
    incubationList.innerHTML = '';
    historyList.innerHTML = '';
    
    const template = document.getElementById('incubation-template');
    const activeIncubations = this.data.incubations.filter(inc => inc.status === 'active');
    const completedIncubations = this.data.incubations.filter(inc => inc.status === 'completed');
    
    // Check for incubations that have reached 21 days and auto-complete them
    const today = new Date();
    activeIncubations.forEach(inc => {
      const hatchDate = new Date(inc.hatchDate);
      if (today >= hatchDate) {
        inc.status = 'completed';
        dbManager.updateIncubation(inc.id, { status: 'completed' });
        this.showNotification(`Incubation "${inc.batchName}" completed automatically after 21 days!`);
      }
    });
    
    // Refresh active list after auto-completion
    const updatedActiveIncubations = this.data.incubations.filter(inc => inc.status === 'active');
    
    if (updatedActiveIncubations.length === 0) {
      incubationList.innerHTML = '<p class="empty-message">No active incubations</p>';
    } else {
      updatedActiveIncubations.forEach(incubation => {
        const clone = template.content.cloneNode(true);
        
        // Set content
        clone.querySelector('.batch-name').textContent = incubation.batchName;
        clone.querySelector('.start-date').textContent = this.formatDate(incubation.startDate);
        clone.querySelector('.hatch-date').textContent = this.formatDate(incubation.hatchDate);
        clone.querySelector('.egg-count').textContent = incubation.eggCount;
        clone.querySelector('.breed').textContent = incubation.breed || 'Not specified';
        
        // Calculate days left and progress
        const totalDays = 21;
        const daysPassed = Math.floor((today - incubation.startDate) / (1000 * 60 * 60 * 24));
        const daysLeft = totalDays - daysPassed;
        
        clone.querySelector('.days-left').textContent = 
          daysLeft > 0 ? `${daysLeft} days left` : 'Ready to hatch!';
        
        // Progress bar
        const progress = Math.min(Math.max((daysPassed / totalDays) * 100, 0), 100);
        clone.querySelector('.progress-bar').style.width = `${progress}%`;
        clone.querySelector('.progress-text').textContent = `${Math.round(progress)}%`;
        
        // Set up buttons
        clone.querySelector('.delete-btn').addEventListener('click', () => {
          this.deleteIncubation(incubation.id);
        });
        
        clone.querySelector('.complete-btn').addEventListener('click', () => {
          this.completeIncubation(incubation.id);
        });
        
        // Add to list
        incubationList.appendChild(clone);
      });
    }
    
    // Render completed incubations in history section
    if (completedIncubations.length === 0) {
      historyList.innerHTML = '<p class="empty-message">No completed incubations</p>';
    } else {
      completedIncubations.forEach(incubation => {
        const clone = template.content.cloneNode(true);
        
        // Set content
        clone.querySelector('.batch-name').textContent = incubation.batchName;
        clone.querySelector('.start-date').textContent = this.formatDate(incubation.startDate);
        clone.querySelector('.hatch-date').textContent = this.formatDate(incubation.hatchDate);
        clone.querySelector('.egg-count').textContent = incubation.eggCount;
        clone.querySelector('.breed').textContent = incubation.breed || 'Not specified';
        clone.querySelector('.days-left').textContent = 'Completed';
        
        // Set progress bar to 100%
        clone.querySelector('.progress-bar').style.width = '100%';
        clone.querySelector('.progress-text').textContent = '100%';
        
        // Only show delete button for history items
        const completeBtn = clone.querySelector('.complete-btn');
        completeBtn.parentNode.removeChild(completeBtn);
        
        clone.querySelector('.delete-btn').addEventListener('click', () => {
          this.deleteIncubation(incubation.id);
        });
        
        // Add to history list
        historyList.appendChild(clone);
      });
    }
  },
  
  // Medication list
  renderMedicationList() {
    const medicationList = document.getElementById('medication-list');
    medicationList.innerHTML = '';
    
    const template = document.getElementById('medication-template');
    
    if (this.data.medications.length === 0) {
      medicationList.innerHTML = '<p class="empty-message">No medication records</p>';
      return;
    }
    
    // Sort by next schedule date
    const sortedMedications = [...this.data.medications].sort((a, b) => {
      if (!a.nextSchedule) return 1;
      if (!b.nextSchedule) return -1;
      return a.nextSchedule - b.nextSchedule;
    });
    
    sortedMedications.forEach(medication => {
      const clone = template.content.cloneNode(true);
      
      // Set content
      clone.querySelector('.medication-name').textContent = medication.name;
      clone.querySelector('.medication-date').textContent = this.formatDate(medication.dateGiven);
      clone.querySelector('.medication-notes').textContent = medication.notes || 'None';
      
      if (medication.nextSchedule) {
        clone.querySelector('.next-schedule').textContent = this.formatDate(medication.nextSchedule);
        
        // Highlight if next schedule is coming up in 3 days
        const today = new Date();
        const daysUntilNext = Math.ceil((medication.nextSchedule - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntilNext <= 3 && daysUntilNext >= 0) {
          clone.querySelector('.next-date').textContent = `In ${daysUntilNext} days`;
        } else if (daysUntilNext < 0) {
          clone.querySelector('.next-date').textContent = 'Overdue';
        } else {
          clone.querySelector('.next-date').textContent = `In ${daysUntilNext} days`;
        }
      } else {
        clone.querySelector('.next-schedule').textContent = 'Not scheduled';
        clone.querySelector('.next-date').textContent = '';
      }
      
      // Set up buttons
      clone.querySelector('.delete-btn').addEventListener('click', () => {
        this.deleteMedication(medication.id);
      });
      
      // Add to list
      medicationList.appendChild(clone);
    });
  },
  
  // Feeding list
  renderFeedingList() {
    const feedingList = document.getElementById('feeding-list');
    feedingList.innerHTML = '';
    
    const template = document.getElementById('feeding-template');
    
    if (this.data.feedings.length === 0) {
      feedingList.innerHTML = '<p class="empty-message">No feeding records</p>';
      return;
    }
    
    // Sort by date (most recent first)
    const sortedFeedings = [...this.data.feedings].sort((a, b) => b.date - a.date);
    
    sortedFeedings.forEach(feeding => {
      const clone = template.content.cloneNode(true);
      
      // Set content
      clone.querySelector('.feed-type').textContent = feeding.feedType;
      clone.querySelector('.feed-date').textContent = this.formatDate(feeding.date);
      clone.querySelector('.feed-amount').textContent = feeding.amount;
      clone.querySelector('.feed-notes').textContent = feeding.notes || 'None';
      
      // Set up buttons
      clone.querySelector('.delete-btn').addEventListener('click', () => {
        this.deleteFeeding(feeding.id);
      });
      
      // Add to list
      feedingList.appendChild(clone);
    });
  },
  
  // Dashboard
  updateDashboard() {
    // Count active incubations
    const activeIncubations = this.data.incubations.filter(inc => inc.status === 'active').length;
    document.getElementById('active-incubations').textContent = activeIncubations;
    
    // Count completed incubations
    const completedIncubations = this.data.incubations.filter(inc => inc.status === 'completed').length;
    
    // Count upcoming medications in the next 7 days
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    const upcomingMedications = this.data.medications.filter(med => {
      return med.nextSchedule && med.nextSchedule >= today && med.nextSchedule <= nextWeek;
    }).length;
    document.getElementById('upcoming-medications').textContent = upcomingMedications;
    
    // Render today's tasks
    this.renderTodayTasks();
  },
  
  renderTodayTasks() {
    const todayTasksList = document.getElementById('today-tasks');
    todayTasksList.innerHTML = '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tasks = [];
    
    // Check for incubations that need turning or are due to hatch
    this.data.incubations.forEach(inc => {
      if (inc.status !== 'active') return;
      
      // Check if hatching is today
      const hatchDate = new Date(inc.hatchDate);
      hatchDate.setHours(0, 0, 0, 0);
      
      if (hatchDate.getTime() === today.getTime()) {
        tasks.push({
          type: 'incubation',
          text: `Hatching day for "${inc.batchName}"!`,
          priority: 'high'
        });
      }
      
      // Turning eggs reminder (3 times a day for first 18 days)
      const daysPassed = Math.floor((today - inc.startDate) / (1000 * 60 * 60 * 24));
      if (daysPassed < 18) {
        tasks.push({
          type: 'incubation',
          text: `Turn eggs for "${inc.batchName}" (3x today)`,
          priority: 'medium'
        });
      }
    });
    
    // Check for medications due today
    this.data.medications.forEach(med => {
      if (med.nextSchedule) {
        const nextDate = new Date(med.nextSchedule);
        nextDate.setHours(0, 0, 0, 0);
        
        if (nextDate.getTime() === today.getTime()) {
          tasks.push({
            type: 'medication',
            text: `Give "${med.name}" medication today`,
            priority: 'high'
          });
        }
      }
    });
    
    // Check for recent feeding schedules
    const yesterdayFeedings = this.data.feedings.filter(feed => {
      const feedDate = new Date(feed.date);
      feedDate.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      
      return feedDate.getTime() === yesterday.getTime();
    });
    
    if (yesterdayFeedings.length === 0) {
      tasks.push({
        type: 'feeding',
        text: 'Record today\'s feeding',
        priority: 'medium'
      });
    }
    
    // Display tasks
    if (tasks.length === 0) {
      todayTasksList.innerHTML = '<li>No tasks for today</li>';
    } else {
      tasks.forEach(task => {
        const li = document.createElement('li');
        li.textContent = task.text;
        li.classList.add(`priority-${task.priority}`);
        todayTasksList.appendChild(li);
      });
    }
  },
  
  // Calendar functions
  initCalendar() {
    this.currentDate = new Date();
    this.renderCalendar();
  },
  
  renderCalendar() {
    const monthYear = document.getElementById('current-month-year');
    const calendarDays = document.getElementById('calendar-days');
    
    // Set month and year
    monthYear.textContent = this.formatMonthYear(this.currentDate);
    
    // Clear previous days
    calendarDays.innerHTML = '';
    
    // Get first day of the month
    const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
    const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
    
    // Create days from previous month
    const firstDayIndex = firstDay.getDay();
    for (let i = 0; i < firstDayIndex; i++) {
      const prevDate = new Date(firstDay);
      prevDate.setDate(prevDate.getDate() - (firstDayIndex - i));
      this.createCalendarDay(calendarDays, prevDate, true);
    }
    
    // Create days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), i);
      this.createCalendarDay(calendarDays, date, false);
    }
    
    // Create days from next month to fill the grid
    const remainingDays = 42 - (firstDayIndex + lastDay.getDate()); // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const nextDate = new Date(lastDay);
      nextDate.setDate(nextDate.getDate() + i);
      this.createCalendarDay(calendarDays, nextDate, true);
    }
  },
  
  createCalendarDay(container, date, inactive) {
    const day = document.createElement('div');
    day.classList.add('calendar-day');
    if (inactive) day.classList.add('inactive');
    
    // Check if it's today
    const today = new Date();
    if (date.getDate() === today.getDate() && 
        date.getMonth() === today.getMonth() && 
        date.getFullYear() === today.getFullYear()) {
      day.classList.add('today');
    }
    
    const dayNumber = document.createElement('div');
    dayNumber.classList.add('day-number');
    dayNumber.textContent = date.getDate();
    day.appendChild(dayNumber);
    
    // Add events for this day
    const dayEvents = document.createElement('div');
    dayEvents.classList.add('day-events');
    
    // Check for incubation events
    this.data.incubations.forEach(inc => {
      // Check start date
      if (this.isSameDay(inc.startDate, date)) {
        const dot = document.createElement('span');
        dot.classList.add('event-dot');
        dot.style.backgroundColor = '#4a7c59';
        dayEvents.appendChild(dot);
      }
      
      // Check hatch date
      if (this.isSameDay(inc.hatchDate, date)) {
        const dot = document.createElement('span');
        dot.classList.add('event-dot');
        dot.style.backgroundColor = '#e63946';
        dayEvents.appendChild(dot);
      }
    });
    
    // Check for medication events
    this.data.medications.forEach(med => {
      if (med.nextSchedule && this.isSameDay(med.nextSchedule, date)) {
        const dot = document.createElement('span');
        dot.classList.add('event-dot');
        dot.style.backgroundColor = '#457b9d';
        dayEvents.appendChild(dot);
      }
    });
    
    day.appendChild(dayEvents);
    
    // Add click event to show details
    day.addEventListener('click', () => {
      // Remove selected class from all days
      document.querySelectorAll('.calendar-day').forEach(d => {
        d.classList.remove('selected');
      });
      
      // Add selected class to this day
      day.classList.add('selected');
      
      // Show details for this day
      this.showDayDetails(date);
    });
    
    container.appendChild(day);
  },
  
  showDayDetails(date) {
    const selectedDate = document.getElementById('selected-date');
    const dateTasks = document.getElementById('date-tasks');
    
    selectedDate.textContent = this.formatDate(date);
    dateTasks.innerHTML = '';
    
    // Collect all events for this day
    const events = [];
    
    // Incubation events
    this.data.incubations.forEach(inc => {
      if (this.isSameDay(inc.startDate, date)) {
        events.push(`Start incubation: "${inc.batchName}"`);
      }
      
      if (this.isSameDay(inc.hatchDate, date)) {
        events.push(`Hatching day: "${inc.batchName}"`);
      }
      
      // Turning eggs reminder
      const startDate = new Date(inc.startDate);
      const daysPassed = Math.floor((date - startDate) / (1000 * 60 * 60 * 24));
      if (daysPassed >= 0 && daysPassed < 18 && inc.status === 'active') {
        events.push(`Turn eggs for "${inc.batchName}"`);
      }
    });
    
    // Medication events
    this.data.medications.forEach(med => {
      if (med.nextSchedule && this.isSameDay(med.nextSchedule, date)) {
        events.push(`Give medication: "${med.name}"`);
      }
    });
    
    // Feeding records
    this.data.feedings.forEach(feed => {
      if (this.isSameDay(feed.date, date)) {
        events.push(`Feeding: ${feed.feedType} (${feed.amount}kg)`);
      }
    });
    
    // Display events
    if (events.length === 0) {
      dateTasks.innerHTML = '<li>No events for this day</li>';
    } else {
      events.forEach(event => {
        const li = document.createElement('li');
        li.textContent = event;
        dateTasks.appendChild(li);
      });
    }
  },
  
  prevMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.renderCalendar();
  },
  
  nextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.renderCalendar();
  },
  
  // Utility functions
  formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  },
  
  formatMonthYear(date) {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  },
  
  isSameDay(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getDate() === d2.getDate() && 
           d1.getMonth() === d2.getMonth() && 
           d1.getFullYear() === d2.getFullYear();
  },
  
  showNotification(message) {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notification-text');
    
    notificationText.textContent = message;
    notification.classList.add('show');
    
    // Log the notification as activity
    if (AuthManager.currentUser) {
      AuthManager.logActivity(AuthManager.currentUser.id, message);
    }
    
    // Auto hide after 5 seconds
    setTimeout(() => {
      notification.classList.remove('show');
    }, 5000);
  },
  
  checkTodayTasks() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check for incubations to hatch today
    this.data.incubations.forEach(inc => {
      if (inc.status === 'active') {
        const hatchDate = new Date(inc.hatchDate);
        hatchDate.setHours(0, 0, 0, 0);
        
        if (hatchDate.getTime() === today.getTime()) {
          this.showNotification(`Hatching day for "${inc.batchName}"!`);
        }
      }
    });
    
    // Check for medications due today
    this.data.medications.forEach(med => {
      if (med.nextSchedule) {
        const nextDate = new Date(med.nextSchedule);
        nextDate.setHours(0, 0, 0, 0);
        
        if (nextDate.getTime() === today.getTime()) {
          this.showNotification(`Medication due today: "${med.name}"`);
        }
      }
    });
  },
  
  // Calculate feed usage summary
  calculateFeedSummary() {
    const feedSummary = document.getElementById('feed-summary');
    
    // Get today, start of week, and start of month
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Calculate totals
    let dailyTotal = 0;
    let weeklyTotal = 0;
    let monthlyTotal = 0;
    
    this.data.feedings.forEach(feed => {
      const feedDate = new Date(feed.date);
      feedDate.setHours(0, 0, 0, 0);
      
      // Check if feed date is today
      if (feedDate.getTime() === today.getTime()) {
        dailyTotal += feed.amount;
      }
      
      // Check if feed date is in current week
      if (feedDate >= startOfWeek) {
        weeklyTotal += feed.amount;
      }
      
      // Check if feed date is in current month
      if (feedDate >= startOfMonth) {
        monthlyTotal += feed.amount;
      }
    });
    
    // Update feed summary card
    document.getElementById('daily-feed').textContent = `${dailyTotal.toFixed(2)} kg`;
    document.getElementById('weekly-feed').textContent = `${weeklyTotal.toFixed(2)} kg`;
    document.getElementById('monthly-feed').textContent = `${monthlyTotal.toFixed(2)} kg`;
  }
};

const AuthManager = {
  isLoggedIn: false,
  currentUser: null,
  isAdmin: false,
  
  async init() {
    // Initialize database
    window.dbManager = await DatabaseManager.init();
    
    this.setupAuthListeners();
    await this.checkLoggedInStatus();
    
    // Initialize with default admin if none exists
    const users = await dbManager.getUsers();
    if (users.length === 0) {
      await this.createDefaultAdmin();
    }
  },
  
  async createDefaultAdmin() {
    const adminUser = {
      name: 'Admin',
      email: 'alexis02',
      password: 'alektit02',
      isAdmin: true,
      registerDate: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
    
    await dbManager.createUser(adminUser);
  },
  
  setupAuthListeners() {
    // Switch between login and register screens
    document.getElementById('show-register').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('login-screen').classList.remove('active');
      document.getElementById('register-screen').classList.add('active');
    });
    
    document.getElementById('show-login').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('register-screen').classList.remove('active');
      document.getElementById('login-screen').classList.add('active');
    });
    
    // Admin login redirect
    document.getElementById('admin-login-btn').addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'admin.html';
    });
    
    // Form submissions
    document.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.loginUser();
    });
    
    document.getElementById('register-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.registerUser();
    });
    
    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
      this.logoutUser();
    });
    
    // Admin form
    document.getElementById('activation-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.generateActivationCode();
    });
    
    // Dark mode toggle
    document.getElementById('dark-mode-toggle').addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    });
  },
  
  async checkLoggedInStatus() {
    const loggedInUser = localStorage.getItem('chickenTrackerCurrentUser');
    
    if (loggedInUser) {
      try {
        const user = JSON.parse(loggedInUser);
        
        // Verify user still exists in database
        const userFromDb = await dbManager.findUserByEmail(user.email);
        if (!userFromDb) {
          // User no longer exists in database
          localStorage.removeItem('chickenTrackerCurrentUser');
          return;
        }
        
        this.isLoggedIn = true;
        this.currentUser = user;
        this.isAdmin = user.isAdmin;
        
        // Update UI for logged in user
        document.getElementById('current-user').textContent = user.name;
        document.getElementById('auth-container').style.display = 'none';
        
        // Show admin button if admin
        if (user.isAdmin) {
          document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'block';
          });
        }
        
        // Apply dark mode if previously set
        if (localStorage.getItem('darkMode') === 'true') {
          document.body.classList.add('dark-mode');
        }
        
        // Update device info
        const deviceInfo = {
          userAgent: navigator.userAgent,
          deviceName: this.getDeviceName(),
        };
        await dbManager.registerDevice(user.id, deviceInfo);
        
        // Log activity
        await this.logActivity(user.id, 'User session restored', deviceInfo.deviceName);
        
        // Initialize chicken tracker
        await ChickenTracker.init();
      } catch (error) {
        console.error("Error checking logged in status:", error);
        localStorage.removeItem('chickenTrackerCurrentUser');
      }
    }
  },
  
  async logActivity(userId, action, deviceInfo = 'Unknown device') {
    const log = {
      userId,
      action,
      deviceInfo,
      timestamp: new Date().toISOString()
    };
    
    await dbManager.createLog(log);
  },
  
  getDeviceName() {
    const userAgent = navigator.userAgent;
    let deviceName = 'Unknown Device';
    
    if (/Android/i.test(userAgent)) {
      deviceName = 'Android Device';
    } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
      deviceName = 'iOS Device';
    } else if (/Windows/i.test(userAgent)) {
      deviceName = 'Windows Device';
    } else if (/Mac/i.test(userAgent)) {
      deviceName = 'Mac Device';
    } else if (/Linux/i.test(userAgent)) {
      deviceName = 'Linux Device';
    }
    
    return deviceName;
  },
  
  async loginUser() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
      const users = await dbManager.getUsers();
      const user = users.find(u => (u.email === email || email === 'alexis02') && u.password === password);
      
      if (user) {
        this.isLoggedIn = true;
        this.currentUser = user;
        this.isAdmin = user.isAdmin;
        
        // Update last login
        await dbManager.updateUserLastLogin(user.id);
        
        // Register device information
        const deviceInfo = {
          userAgent: navigator.userAgent,
          deviceName: this.getDeviceName(),
        };
        await dbManager.registerDevice(user.id, deviceInfo);
        
        // Store login status
        localStorage.setItem('chickenTrackerCurrentUser', JSON.stringify(user));
        
        // Update UI
        document.getElementById('current-user').textContent = user.name;
        document.getElementById('auth-container').style.display = 'none';
        
        // Show admin button if admin
        if (user.isAdmin) {
          document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'block';
          });
        }
        
        // Log activity
        await this.logActivity(user.id, 'User logged in', deviceInfo.deviceName);
        
        // Initialize chicken tracker
        await ChickenTracker.init();
      } else {
        alert('Invalid email or password');
      }
    } catch (error) {
      console.error("Error during login:", error);
      alert('An error occurred during login. Please try again.');
    }
  },
  
  async registerUser() {
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const activationCode = document.getElementById('activation-code').value;
    
    // Check if email already registered
    const existingUser = await dbManager.findUserByEmail(email);
    if (existingUser) {
      alert('Email already registered');
      return;
    }
    
    // Verify activation code
    const code = await dbManager.findCode(activationCode, email);
    if (!code) {
      alert('Invalid activation code');
      return;
    }
    
    // Create new user
    const newUser = {
      name,
      email,
      password,
      isAdmin: false,
      registerDate: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
    
    // Add user to database
    const createdUser = await dbManager.createUser(newUser);
    
    // Mark code as used
    await dbManager.markCodeAsUsed(code.id);
    
    // Register device information
    const deviceInfo = {
      userAgent: navigator.userAgent,
      deviceName: this.getDeviceName(),
    };
    await dbManager.registerDevice(createdUser.id, deviceInfo);
    
    // Log activity
    await this.logActivity(createdUser.id, 'New user registered', deviceInfo.deviceName);
    
    // Show success and switch to login
    alert('Registration successful! You can now log in.');
    document.getElementById('register-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('register-form').reset();
  },
  
  async logoutUser() {
    this.isLoggedIn = false;
    this.currentUser = null;
    this.isAdmin = false;
    localStorage.removeItem('chickenTrackerCurrentUser');
    document.getElementById('auth-container').style.display = 'block';
    document.getElementById('current-user').textContent = '';
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = 'none';
    });
  }
};

// Initialize both managers when document is ready
document.addEventListener('DOMContentLoaded', async () => {
  await AuthManager.init();
  // ChickenTracker will be initialized after successful login
});