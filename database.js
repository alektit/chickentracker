const DatabaseManager = {
  room: null,
  
  init() {
    // Initialize WebsimSocket connection
    this.room = new WebsimSocket();
    this.setupEventHandlers();
    return this;
  },
  
  setupEventHandlers() {
    // Handle WebSocket connection events
    this.room.onmessage = (event) => {
      const data = event.data;
      switch (data.type) {
        case "connected":
          console.log(`Client ${data.clientId} connected as ${data.username}`);
          break;
        case "disconnected":
          console.log(`Client ${data.clientId} disconnected`);
          break;
      }
    };
  },
  
  // User Management
  async getUsers() {
    return this.room.collection('users').getList();
  },
  
  async createUser(userData) {
    return await this.room.collection('users').create(userData);
  },
  
  async findUserByEmail(email) {
    const users = await this.getUsers();
    return users.find(user => user.email === email);
  },
  
  async updateUserLastLogin(userId) {
    const users = await this.getUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      return await this.room.collection('users').update(user.id, {
        lastLogin: new Date().toISOString(),
        lastDevice: navigator.userAgent
      });
    }
    return null;
  },
  
  // Chicken Tracker Data
  async getIncubations(userId) {
    const incubations = await this.room.collection('incubations').filter({userId: userId}).getList();
    // Convert date strings to Date objects
    return incubations.map(inc => ({
      ...inc,
      startDate: new Date(inc.startDate),
      hatchDate: new Date(inc.hatchDate)
    }));
  },
  
  async createIncubation(incubationData) {
    return await this.room.collection('incubations').create(incubationData);
  },
  
  async updateIncubation(id, incubationData) {
    return await this.room.collection('incubations').update(id, incubationData);
  },
  
  async deleteIncubation(id) {
    return await this.room.collection('incubations').delete(id);
  },
  
  async getMedications(userId) {
    const medications = await this.room.collection('medications').filter({userId: userId}).getList();
    // Convert date strings to Date objects
    return medications.map(med => ({
      ...med,
      dateGiven: new Date(med.dateGiven),
      nextSchedule: med.nextSchedule ? new Date(med.nextSchedule) : null
    }));
  },
  
  async createMedication(medicationData) {
    return await this.room.collection('medications').create(medicationData);
  },
  
  async deleteMedication(id) {
    return await this.room.collection('medications').delete(id);
  },
  
  async getFeedings(userId) {
    const feedings = await this.room.collection('feedings').filter({userId: userId}).getList();
    // Convert date strings to Date objects
    return feedings.map(feed => ({
      ...feed,
      date: new Date(feed.date)
    }));
  },
  
  async createFeeding(feedingData) {
    return await this.room.collection('feedings').create(feedingData);
  },
  
  async deleteFeeding(id) {
    return await this.room.collection('feedings').delete(id);
  },
  
  // Activation Codes
  async getCodes() {
    return this.room.collection('activationCodes').getList();
  },
  
  async createCode(codeData) {
    return await this.room.collection('activationCodes').create(codeData);
  },
  
  async findCode(code, email) {
    const codes = await this.getCodes();
    return codes.find(c => c.code === code && c.email === email && !c.used);
  },
  
  async markCodeAsUsed(codeId) {
    return await this.room.collection('activationCodes').update(codeId, { used: true });
  },
  
  // Activity Logs
  async getLogs() {
    return this.room.collection('activityLogs').getList();
  },
  
  async getUserLogs(userId) {
    return this.room.collection('activityLogs').filter({userId: userId}).getList();
  },
  
  async createLog(logData) {
    return await this.room.collection('activityLogs').create(logData);
  },
  
  // Device Tracking
  async getDevices() {
    return this.room.collection('devices').getList();
  },
  
  async getUserDevices(userId) {
    return this.room.collection('devices').filter({userId: userId}).getList();
  },
  
  async registerDevice(userId, deviceInfo) {
    const devices = await this.getDevices();
    const existingDevice = devices.find(d => 
      d.userId === userId && d.userAgent === deviceInfo.userAgent);
    
    if (existingDevice) {
      return await this.room.collection('devices').update(existingDevice.id, {
        lastSeen: new Date().toISOString(),
        ipAddress: deviceInfo.ipAddress || 'unknown'
      });
    } else {
      return await this.room.collection('devices').create({
        userId,
        userAgent: deviceInfo.userAgent,
        deviceName: deviceInfo.deviceName || 'Unknown Device',
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        ipAddress: deviceInfo.ipAddress || 'unknown'
      });
    }
  }
};