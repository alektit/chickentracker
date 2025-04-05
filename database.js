const DatabaseManager = {
  room: null,
  
  init() {
    // Initialize WebsimSocket connection
    this.room = new WebsimSocket();
    this.setupEventHandlers();
    return Promise.resolve(this);  // Return a promise to ensure async completion
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
  
  // Chicken Tracker Data
  async getIncubations() {
    const incubations = await this.room.collection('incubations').getList();
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
  
  async getMedications() {
    const medications = await this.room.collection('medications').getList();
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
  
  async getFeedings() {
    const feedings = await this.room.collection('feedings').getList();
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
  }
};