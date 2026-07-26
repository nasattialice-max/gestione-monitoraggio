/**
 * Volley Team Manager & Physical Monitoring System
 * Core Frontend JavaScript - Pure Client-Side SPA
 */

class AthleteHubApp {
  constructor() {
    this.db = null;
    this.activeTab = 'dashboard';
    this.selectedPlayerId = null;
    this.charts = {}; // Keep references to active ChartJS instances
    this.defaultCloudUrl = '';
    this.cloudUrl = localStorage.getItem('soccer_cloud_url') || '';
    
    // Bind event handlers
    this.handleTabClick = this.handleTabClick.bind(this);
    this.handleDateChange = this.handleDateChange.bind(this);
    this.handleFvSubmit = this.handleFvSubmit.bind(this);
    this.handlePhysicalTestSubmit = this.handlePhysicalTestSubmit.bind(this);
    this.saveCloudUrl = this.saveCloudUrl.bind(this);
    this.pullFromCloud = this.pullFromCloud.bind(this);
    this.syncToCloud = this.syncToCloud.bind(this);
  }

  init() {
    // 1. Load data from localStorage or mock-data
    this.loadDatabase();

    // 2. Initialize date inputs to current date (local timezone safe)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const gDate = document.getElementById('global-date');
    const dDate = document.getElementById('daily-log-date');
    const tDate = document.getElementById('test-date');
    if (gDate) gDate.value = todayStr;
    if (dDate) dDate.value = todayStr;
    if (tDate) tDate.value = todayStr;

    // 3. Setup event listeners
    this.setupEventListeners();

    // 4. Initialize Lucide Icons
    try {
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    } catch (e) {
      console.warn("Lucide icons failed to load:", e);
    }

    // 5. Render first view and team branding
    this.renderTeamBranding();
    this.showTab('dashboard');
    this.updateStatusIndicator();
    
    // 6. Initialize Player Portal urls and imports
    this.initPortalUrls();

    // 7. Initialize Cloud Sync and perform initial pull if URL is configured
    const urlInput = document.getElementById('config-cloud-url');
    if (urlInput) {
      urlInput.value = this.cloudUrl || this.defaultCloudUrl;
    }
    const activeUrl = this.cloudUrl || this.defaultCloudUrl;
    if (activeUrl) {
      this.cloudUrl = activeUrl;
      this.pullFromCloud();
    }

    // 8. Check for Roster & Kiosk URL Query Parameters
    this.decodeRosterParam();
    const urlParams = new URLSearchParams(window.location.search);
    const kioskParam = urlParams.get('kiosk');
    if (kioskParam === 'rpe' || kioskParam === 'post-workout') {
      this.startKiosk('post-workout');
    } else if (kioskParam === 'recovery' || kioskParam === 'morning-recovery') {
      this.startKiosk('morning-recovery');
    }

    // 9. Real-time cross-tab synchronization listener
    window.addEventListener('storage', (e) => {
      if (e.key === 'soccer_team_db') {
        this.loadDatabase();
        this.renderActiveTab();
        this.showToast("⚡ Nuovi dati ricevuti ed aggiornati in tempo reale!");
      }
    });
  }

  // DATABASE OPERATIONS
  loadDatabase() {
    const localData = localStorage.getItem('soccer_team_db');
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        const sampleNames = ['marco rossi', 'giulia bianchi', 'martina rossi', 'sara verdi', 'elena neri', 'sofia russo'];
        const sampleIds = ['p1', 'p2', 'p3', 'p4', 'p5'];
        
        if (parsed.players && Array.isArray(parsed.players)) {
          const originalCount = parsed.players.length;
          parsed.players = parsed.players.filter(p => {
            const isSampleId = sampleIds.includes(p.id);
            const isSampleName = sampleNames.includes((p.name || '').toLowerCase().trim());
            return !isSampleId && !isSampleName;
          });
          if (parsed.players.length !== originalCount) {
            this.db = parsed;
            this.saveDatabase(true);
          }
        }
        this.db = parsed;
        if (!this.db || !Array.isArray(this.db.players)) {
          this.clearDatabase();
          return;
        }
        if (!this.db.neuromuscularTests) this.db.neuromuscularTests = {};
        if (!this.db.calendarEvents) this.db.calendarEvents = [];
        if (!this.db.settings) {
          this.db.settings = {
            teamName: "U.S. MOZZO",
            hubName: "sez. PALLAVOLO",
            logoUrl: "us_mozzo_logo.png"
          };
        }
      } catch (e) {
        console.error("Errore nel parsing del database locale. Inizializzo pulito.", e);
        this.clearDatabase();
      }
    } else {
      this.db = (window.MOCK_DATA && Array.isArray(window.MOCK_DATA.players)) ? JSON.parse(JSON.stringify(window.MOCK_DATA)) : generateMockData();
    }
  }

  renderTeamBranding() {
    const settings = (this.db && this.db.settings) ? this.db.settings : {
      teamName: "U.S. MOZZO",
      hubName: "sez. PALLAVOLO",
      logoUrl: "us_mozzo_logo.png"
    };

    const nameEl = document.getElementById('team-name-display');
    const hubEl = document.getElementById('team-hub-display');
    const logoEl = document.getElementById('team-logo-img');
    const kioskLogo = document.getElementById('kiosk-team-logo');

    if (nameEl) nameEl.textContent = settings.teamName || "U.S. MOZZO";
    if (hubEl) hubEl.textContent = settings.hubName || "sez. PALLAVOLO";
    if (logoEl && settings.logoUrl) logoEl.src = settings.logoUrl;
    if (kioskLogo && settings.logoUrl) kioskLogo.src = settings.logoUrl;

    const customNameInput = document.getElementById('custom-team-name');
    const customHubInput = document.getElementById('custom-hub-name');
    if (customNameInput) customNameInput.value = settings.teamName || "U.S. MOZZO";
    if (customHubInput) customHubInput.value = settings.hubName || "sez. PALLAVOLO";
  }

  handleTeamCustomSubmit(e) {
    if (e) e.preventDefault();
    const customNameInput = document.getElementById('custom-team-name');
    const customHubInput = document.getElementById('custom-hub-name');
    
    if (!this.db.settings) this.db.settings = {};
    if (customNameInput) this.db.settings.teamName = customNameInput.value.trim() || "U.S. MOZZO";
    if (customHubInput) this.db.settings.hubName = customHubInput.value.trim() || "sez. PALLAVOLO";
    
    this.saveDatabase();
    this.renderTeamBranding();
    
    const msg = document.getElementById('custom-save-msg');
    if (msg) {
      msg.style.display = 'inline';
      setTimeout(() => { msg.style.display = 'none'; }, 3000);
    }
  }

  handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (!this.db.settings) this.db.settings = {};
      this.db.settings.logoUrl = evt.target.result;
      this.saveDatabase();
      this.renderTeamBranding();
      const msg = document.getElementById('custom-save-msg');
      if (msg) {
        msg.style.display = 'inline';
        setTimeout(() => { msg.style.display = 'none'; }, 3000);
      }
    };
    reader.readAsDataURL(file);
  }

  resetTeamBranding() {
    if (confirm("Vuoi ripristinare il logo e il nome predefiniti?")) {
      if (!this.db.settings) this.db.settings = {};
      this.db.settings.teamName = "U.S. MOZZO";
      this.db.settings.hubName = "sez. PALLAVOLO";
      this.db.settings.logoUrl = "us_mozzo_logo.png";
      this.saveDatabase();
      this.renderTeamBranding();
    }
  }

  saveDatabase(skipCloud = false) {
    localStorage.setItem('soccer_team_db', JSON.stringify(this.db));
    this.updateStatusIndicator();
    if (this.cloudUrl && !skipCloud) {
      this.syncToCloud();
    }
  }

  resetToMock() {
    this.clearDatabase();
  }

  clearDatabase() {
    this.db = {
      players: [],
      dailyLogs: [],
      physicalTests: [],
      squatProfiles: {},
      neuromuscularTests: {},
      calendarEvents: [],
      settings: {
        teamName: "U.S. MOZZO",
        hubName: "sez. PALLAVOLO",
        logoUrl: "us_mozzo_logo.png"
      }
    };
    this.saveDatabase(true);
    this.showToast("Database inizializzato pulito (0 Giocatrici).");
    this.renderTeamBranding();
    this.renderActiveTab();
  }

  updateStatusIndicator() {
    const dot = document.getElementById('db-status-dot');
    const text = document.getElementById('db-status-text');
    const counts = document.getElementById('db-status-counts');
    
    if (this.db) {
      dot.className = 'status-indicator online';
      text.textContent = 'Database Attivo';
      const playerCnt = this.db.players.length;
      const logCnt = this.db.dailyLogs.length;
      counts.textContent = `${playerCnt} Giocatrici | ${logCnt} Log Giornalieri`;
      
      // Update backup stats
      const bPlayers = document.getElementById('back-players-cnt');
      const bLogs = document.getElementById('back-logs-cnt');
      const bTests = document.getElementById('back-tests-cnt');
      if (bPlayers) bPlayers.textContent = playerCnt;
      if (bLogs) bLogs.textContent = logCnt;
      if (bTests) bTests.textContent = this.db.physicalTests.length;
    } else {
      dot.className = 'status-indicator offline';
      text.textContent = 'Non inizializzato';
      counts.textContent = 'Nessun dato';
    }
  }

  // NAVIGATION & TAB MANAGEMENT
  setupEventListeners() {
    if (this.listenersSetup) return;
    this.listenersSetup = true;
    
    // Sidebar navigation clicks
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', this.handleTabClick);
    });

    // Date changes
    document.getElementById('global-date').addEventListener('change', this.handleDateChange);
    document.getElementById('daily-log-date').addEventListener('change', (e) => {
      document.getElementById('global-date').value = e.target.value;
      this.renderDailyLog();
    });

    // Add Player Modal buttons
    document.getElementById('btn-add-player').addEventListener('click', () => this.openPlayerModal());
    document.getElementById('btn-close-modal').addEventListener('click', () => this.closePlayerModal());
    document.getElementById('btn-cancel-modal').addEventListener('click', () => this.closePlayerModal());
    document.getElementById('player-form').addEventListener('submit', this.playerFormSubmit.bind(this));

    // Player detail drawer close
    document.getElementById('btn-close-drawer').addEventListener('click', () => {
      document.getElementById('player-detail-drawer').classList.remove('open');
    });

    // Player detail drawer tabs
    document.querySelectorAll('.drawer-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.drawer-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.drawer-tab-content').forEach(c => c.classList.remove('active'));
        
        e.target.classList.add('active');
        const tabId = e.target.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
      });
    });

    // Daily Log Action buttons
    document.getElementById('btn-fill-defaults').addEventListener('click', () => this.fillDailyDefaults());
    document.getElementById('btn-save-all-logs').addEventListener('click', () => this.saveDailyLogs());

    // Squat Profile Submit Form
    document.getElementById('fv-point-form').addEventListener('submit', this.handleFvSubmit);
    document.getElementById('fv-player-select').addEventListener('change', () => this.renderFvProfile());

    // Physical Test Form Submit
    document.getElementById('physical-test-form').addEventListener('submit', this.handlePhysicalTestSubmit);
    document.getElementById('test-type-select').addEventListener('change', () => this.togglePhysicalTestPowerField());
    document.getElementById('test-type-filter').addEventListener('change', () => this.renderPhysicalTests());
    document.getElementById('test-history-search').addEventListener('input', () => this.renderPhysicalTests());
    
    // Inizializza visibilità del campo potenza
    this.togglePhysicalTestPowerField();

    // Roster search filter
    document.getElementById('roster-search').addEventListener('input', () => this.renderRoster());

    // Neuro loads listeners
    document.getElementById('btn-close-neuro-drawer').addEventListener('click', () => this.closeNeuroDrawer());
    document.getElementById('neuro-test-form').addEventListener('submit', (e) => this.handleNeuroTestSubmit(e));
    document.getElementById('neuro-type').addEventListener('change', () => this.toggleNeuroFormFields());

    // Backup actions
    document.getElementById('btn-export-db').addEventListener('click', () => this.exportDatabase());
    document.getElementById('btn-load-mock').addEventListener('click', () => {
      if (confirm("Sei sicuro? Questo sovrascriverà tutti i dati correnti con i dati di prova.")) {
        this.resetToMock();
        this.renderActiveTab();
      }
    });
    document.getElementById('btn-clear-db').addEventListener('click', () => {
      if (confirm("ATTENZIONE! Questo cancellerà tutti i dati in modo definitivo. Si consiglia di effettuare un backup prima.")) {
        this.clearDatabase();
        this.renderActiveTab();
      }
    });

    // Drag and drop database import
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('import-db-file');

    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.importDatabaseFile(files[0]);
      }
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.importDatabaseFile(e.target.files[0]);
      }
    });
  }

  handleTabClick(e) {
    const btn = e.currentTarget;
    const target = btn.getAttribute('data-target');
    this.showTab(target);
  }

  handleDateChange(e) {
    const newDate = e.target.value;
    document.getElementById('daily-log-date').value = newDate;
    this.renderActiveTab();
  }

  showTab(tabId) {
    this.activeTab = tabId;
    
    // Update navigation sidebar active class
    document.querySelectorAll('.nav-item').forEach(btn => {
      if (btn.getAttribute('data-target') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update visible viewport screen
    document.querySelectorAll('.viewport').forEach(view => {
      if (view.id === tabId) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    // Update Header Text based on tab
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    
    switch (tabId) {
      case 'dashboard':
        pageTitle.textContent = 'Dashboard Squadra';
        pageSubtitle.textContent = 'Riepilogo e andamento delle metriche quotidiane';
        break;
      case 'roster':
        pageTitle.textContent = 'Rosa Giocatrici';
        pageSubtitle.textContent = 'Anagrafica Giocatrici e visualizzazione schede individuali';
        break;
      case 'daily-log':
        pageTitle.textContent = 'Inserimento Daily Monitoring';
        pageSubtitle.textContent = 'Inserimento delle misurazioni giornaliere di fatica e CMJ';
        break;
      case 'fv-profile':
        pageTitle.textContent = 'Profilazione Forza-Velocità';
        pageSubtitle.textContent = 'Analisi e tracciamento della relazione Forza-Velocità nello Squat';
        break;
      case 'neuro-loads':
        pageTitle.textContent = 'Carichi Neuromuscolari Allenanti';
        pageSubtitle.textContent = 'Profilazione dei test di salto CMJ e SJ suddivisi per categorie e carichi';
        break;
      case 'aerobic-loads':
        pageTitle.textContent = 'Carichi Aerobici (VAM)';
        pageSubtitle.textContent = 'Tabella distanze per ripetute intermittenti basate sulle percentuali VAM';
        break;
      case 'player-portal':
        pageTitle.textContent = 'Raccolta Dati Giocatrici';
        pageSubtitle.textContent = 'Terminale fisso per lo spogliatoio e QR Code / Link per i moduli online';
        break;
      case 'physical-tests':
        pageTitle.textContent = 'Test Fisici & Salto';
        pageSubtitle.textContent = 'Registrazione e storico dei test fisici prestazionali';
        break;
      case 'backup-panel':
        pageTitle.textContent = 'Gestione Database';
        pageSubtitle.textContent = 'Esportazione, importazione e manutenzione dei dati locali';
        break;
      case 'schedule-panel':
        pageTitle.textContent = 'Programmazione dello Staff';
        pageSubtitle.textContent = 'Calendario degli impegni di allenamento, partite e obiettivi del giorno';
        break;
    }

    this.renderActiveTab();
  }

  renderActiveTab() {
    switch (this.activeTab) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'roster':
        this.renderRoster();
        break;
      case 'daily-log':
        this.renderDailyLog();
        break;
      case 'fv-profile':
        this.populatePlayerSelects();
        this.renderFvProfile();
        break;
      case 'neuro-loads':
        this.renderNeuroLoads();
        break;
      case 'aerobic-loads':
        this.renderAerobicLoads();
        break;
      case 'player-portal':
        this.generatePortalQrs();
        break;
      case 'physical-tests':
        this.populatePlayerSelects();
        this.renderPhysicalTests();
        break;
      case 'backup-panel':
        this.updateStatusIndicator();
        break;
      case 'schedule-panel':
        this.renderSchedule();
        break;
    }
  }

  // HELPER METRICS & DATA SELECTORS
  getPlayerGlobalAverageCmj(playerId) {
    const logs = this.db.dailyLogs.filter(l => l.playerId === playerId && l.cmjHeight > 0);
    if (logs.length === 0) return 0;
    const sum = logs.reduce((acc, log) => acc + log.cmjHeight, 0);
    return Math.round((sum / logs.length) * 10) / 10;
  }

  getReadinessStatus(todayCmj, globalAvgCmj) {
    if (!todayCmj || !globalAvgCmj) return { status: 'N/D', deviation: 0, class: 'text-muted', badgeClass: 'badge-secondary' };
    const devPercent = ((todayCmj - globalAvgCmj) / globalAvgCmj) * 100;
    
    if (devPercent < -3.0) {
      return { status: 'Sotto Media', deviation: Math.round(devPercent * 10) / 10, class: 'text-danger', badgeClass: 'badge-danger' };
    } else if (devPercent > 3.0) {
      return { status: 'Sopra Media', deviation: Math.round(devPercent * 10) / 10, class: 'text-info', badgeClass: 'badge-info' };
    } else {
      return { status: 'In Media', deviation: Math.round(devPercent * 10) / 10, class: 'text-success', badgeClass: 'badge-success' };
    }
  }

  calculateActiveTeamAvgRpe() {
    let sum = 0;
    let count = 0;
    
    this.db.players.forEach(p => {
      // Exclude injured and rehab players
      if (p.status === 'Infortunato' || p.status === 'In recupero') return;
      
      const rpeSelect = document.getElementById(`rpe-${p.id}`);
      if (rpeSelect) {
        const val = parseInt(rpeSelect.value);
        if (val > 0) {
          sum += val;
          count++;
        }
      }
    });
    
    return count > 0 ? (sum / count) : 0;
  }

  updateAllDailyBadges() {
    const avgRpe = this.calculateActiveTeamAvgRpe();
    
    this.db.players.forEach(p => {
      // 1. CMJ Readiness Badge (individual comparison)
      const cmjInput = document.getElementById(`cmj-${p.id}`);
      if (cmjInput) {
        const cmjVal = parseFloat(cmjInput.value);
        const avgCmj = this.getPlayerGlobalAverageCmj(p.id);
        const badgeReadiness = document.getElementById(`badge-readiness-${p.id}`);
        
        if (badgeReadiness) {
          const readiness = !isNaN(cmjVal) && cmjVal > 0 && avgCmj > 0
            ? this.getReadinessStatus(cmjVal, avgCmj)
            : { status: 'N/D', deviation: 0, badgeClass: 'badge-secondary' };
          
          badgeReadiness.className = `badge ${readiness.badgeClass}`;
          badgeReadiness.textContent = readiness.status + (readiness.deviation !== 0 ? ` (${readiness.deviation > 0 ? '+' : ''}${readiness.deviation}%)` : '');
        }
        
        // Update card completed status outline
        const card = document.getElementById(`row-${p.id}`);
        if (card) {
          const isCompleted = !isNaN(cmjVal) && cmjVal > 0;
          if (isCompleted) card.classList.add('completed');
          else card.classList.remove('completed');
        }
      }
      
      // 2. RPE Comparison Badge (Relative fatigue vs active team average)
      const rpeSelect = document.getElementById(`rpe-${p.id}`);
      if (rpeSelect) {
        const rpeVal = parseInt(rpeSelect.value);
        const badgePsycho = document.getElementById(`badge-psycho-${p.id}`);
        
        if (badgePsycho) {
          if (rpeVal === 0 || avgRpe === 0 || p.status === 'Infortunato' || p.status === 'In recupero') {
            badgePsycho.className = 'badge badge-secondary';
            badgePsycho.textContent = 'N/D';
          } else {
            const diff = rpeVal - avgRpe;
            let status = 'In Media';
            let badgeClass = 'badge-success';
            
            if (diff > 2.0) {
              status = 'Critico';
              badgeClass = 'badge-danger';
            } else if (diff > 1.0) {
              status = 'Sopra Media';
              badgeClass = 'badge-warning';
            } else if (diff < -2.0) {
              status = 'Sotto Media';
              badgeClass = 'badge-info';
            }
            
            const diffSign = diff > 0 ? '+' : '';
            const formattedDiff = Math.round(diff * 10) / 10;
            badgePsycho.className = `badge ${badgeClass}`;
            badgePsycho.textContent = `${status} (${diffSign}${formattedDiff})`;
          }
        }
      }
    });
  }

  // 1. DASHBOARD VIEW RENDER
  renderDashboard() {
    const selectedDate = document.getElementById('global-date').value;
    const logsToday = this.db.dailyLogs.filter(l => l.date === selectedDate);
    const activePlayers = this.db.players.filter(p => p.status !== 'Infortunato');
    
    // Core KPIs calculations
    let readinessInOrAboveCount = 0;
    let loggedTodayCount = 0;
    let sumRpe = 0;
    let sumDuration = 0;
    let sumSleepHours = 0;
    let sumSleepQuality = 0;
    let sleepLogCount = 0;
    
    const alertsList = [];
    
    this.db.players.forEach(p => {
      const log = logsToday.find(l => l.playerId === p.id);
      const globalAvg = this.getPlayerGlobalAverageCmj(p.id);
      
      if (log) {
        loggedTodayCount++;
        
        // 1. CMJ Readiness
        if (log.cmjHeight > 0 && globalAvg > 0) {
          const readiness = this.getReadinessStatus(log.cmjHeight, globalAvg);
          if (readiness.status === 'In Media' || readiness.status === 'Sopra Media') {
            readinessInOrAboveCount++;
          }
          if (readiness.status === 'Sotto Media') {
            alertsList.push({
              player: p.name,
              reason: 'CMJ Sotto Media',
              value: `${log.cmjHeight} cm vs media ${globalAvg} cm`,
              deviation: `${readiness.deviation}%`,
              severity: 'danger',
              doms: log.doms,
              sleep: `${log.sleepDuration}h (Qualità: ${log.sleepQuality})`
            });
          }
        }
        
        // 2. Workload / RPE
        if (log.rpe > 0 && log.duration > 0) {
          sumRpe += log.rpe;
          sumDuration += log.duration;
        }

        // 3. Sleep
        if (log.sleepDuration > 0) {
          sumSleepHours += log.sleepDuration;
          sumSleepQuality += log.sleepQuality;
          sleepLogCount++;
        }

        // 4. Heavy Muscle Soreness (DOMS) Alert
        if (log.doms >= 4) {
          alertsList.push({
            player: p.name,
            reason: `DOMS Elevato (${log.doms}/5)`,
            value: log.domsNotes || 'Dolore muscolare significativo',
            deviation: '-',
            severity: 'warning',
            doms: log.doms,
            sleep: `${log.sleepDuration}h`
          });
        }

        // 5. Bad Sleep Alert
        if (log.sleepDuration < 6.5) {
          alertsList.push({
            player: p.name,
            reason: `Sonno Insufficiente (${log.sleepDuration}h)`,
            value: `Qualità: ${log.sleepQuality}/5`,
            deviation: '-',
            severity: 'warning',
            doms: log.doms,
            sleep: `${log.sleepDuration}h`
          });
        }
      }
    });

    // Populate KPIs into UI
    const readinessPct = loggedTodayCount > 0 ? Math.round((readinessInOrAboveCount / loggedTodayCount) * 100) : 0;
    document.getElementById('dash-readiness-value').textContent = loggedTodayCount > 0 ? `${readinessPct}%` : 'N/D';
    document.getElementById('dash-readiness-desc').textContent = loggedTodayCount > 0 ? `${readinessInOrAboveCount} su ${loggedTodayCount} Giocatrici monitorati` : 'Nessun log per oggi';

    // RPE Average (Session RPE = Avg RPE * Avg Duration)
    const avgRpeVal = loggedTodayCount > 0 && sumDuration > 0 ? Math.round(sumRpe / loggedTodayCount * 10) / 10 : 0;
    const avgDurationVal = loggedTodayCount > 0 && sumDuration > 0 ? Math.round(sumDuration / loggedTodayCount) : 0;
    const sessionRpeVal = Math.round(avgRpeVal * avgDurationVal);
    document.getElementById('dash-rpe-value').textContent = sessionRpeVal > 0 ? sessionRpeVal : '0';
    document.getElementById('dash-rpe-desc').textContent = sessionRpeVal > 0 ? `RPE Medio: ${avgRpeVal} | Durata Media: ${avgDurationVal}m` : 'Nessuna attività registrata';

    // Availability status
    const injuredCount = this.db.players.filter(p => p.status === 'Infortunato').length;
    const rehabCount = this.db.players.filter(p => p.status === 'In recupero').length;
    document.getElementById('dash-injured-value').textContent = injuredCount + rehabCount;
    document.getElementById('dash-injured-desc').textContent = `${injuredCount} Infortunati | ${rehabCount} In recupero`;

    // Sleep Quality & Duration
    const avgSleepQ = sleepLogCount > 0 ? Math.round((sumSleepQuality / sleepLogCount) * 10) / 10 : 0;
    const avgSleepD = sleepLogCount > 0 ? Math.round((sumSleepHours / sleepLogCount) * 10) / 10 : 0;
    document.getElementById('dash-sleep-value').textContent = avgSleepQ > 0 ? `${avgSleepQ} / 5` : 'N/D';
    document.getElementById('dash-sleep-desc').textContent = avgSleepD > 0 ? `Durata Media Sonno: ${avgSleepD} ore` : 'Nessun dato sonno inserito';

    // Render Alerts table
    const alertBody = document.getElementById('dashboard-alerts-body');
    alertBody.innerHTML = '';
    
    const alertsBadge = document.getElementById('alerts-count');
    alertsBadge.textContent = `${alertsList.length} Alert`;
    alertsBadge.className = `badge ${alertsList.length > 0 ? 'badge-danger' : 'badge-success'}`;

    if (alertsList.length === 0) {
      alertBody.innerHTML = `<tr><td colspan="6" style="text-align: center;" class="text-muted">Nessuna segnalazione di fatica per oggi. Squadra in salute!</td></tr>`;
    } else {
      alertsList.forEach(a => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${a.player}</strong></td>
          <td><span class="badge ${a.severity === 'danger' ? 'badge-danger' : 'badge-warning'}">${a.reason}</span></td>
          <td>${a.value}</td>
          <td>${a.deviation}</td>
          <td>${a.doms}/5</td>
          <td>${a.sleep}</td>
        `;
        alertBody.appendChild(row);
      });
    }

    // DRAW DASHBOARD CHARTS
    this.drawTeamLoadChart();
    this.drawTeamReadinessChart(logsToday);

    // RENDER STAFF NOTEBOOK
    this.renderStaffNotebook();
  }

  drawTeamLoadChart() {
    const ctx = document.getElementById('team-load-chart').getContext('2d');
    if (this.charts['team-load']) {
      this.charts['team-load'].destroy();
    }

    const today = new Date();
    const dates = [];
    const workloads = [];
    const readinessScores = [];

    // Get statistics for the last 14 days
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      // Formatting label (es. "05 Lug")
      const label = d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
      dates.push(label);

      const logsOnDate = this.db.dailyLogs.filter(l => l.date === dateStr);
      let daySumRpe = 0;
      let daySumDur = 0;
      let dayCmjDevSum = 0;
      let countCmj = 0;

      logsOnDate.forEach(l => {
        if (l.rpe > 0 && l.duration > 0) {
          daySumRpe += l.rpe;
          daySumDur += l.duration;
        }

        const globalAvg = this.getPlayerGlobalAverageCmj(l.playerId);
        if (l.cmjHeight > 0 && globalAvg > 0) {
          const dev = ((l.cmjHeight - globalAvg) / globalAvg) * 100;
          dayCmjDevSum += dev;
          countCmj++;
        }
      });

      // Session RPE = Mean RPE * Mean Duration
      const meanRpe = logsOnDate.length > 0 ? (daySumRpe / logsOnDate.length) : 0;
      const meanDur = logsOnDate.length > 0 ? (daySumDur / logsOnDate.length) : 0;
      const dayLoad = Math.round(meanRpe * meanDur);
      workloads.push(dayLoad);

      const dayCmjDev = countCmj > 0 ? Math.round((dayCmjDevSum / countCmj) * 10) / 10 : 0;
      readinessScores.push(dayCmjDev);
    }

    this.charts['team-load'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'Carico di Lavoro Medio (Session-RPE)',
            data: workloads,
            backgroundColor: 'rgba(0, 168, 232, 0.45)',
            borderColor: '#00a8e8',
            borderWidth: 2,
            borderRadius: 6,
            yAxisID: 'y'
          },
          {
            label: 'Deviazione CMJ Media (%)',
            data: readinessScores,
            type: 'line',
            borderColor: '#1e40af',
            backgroundColor: 'transparent',
            borderWidth: 3,
            pointBackgroundColor: '#1e40af',
            tension: 0.3,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#f3f4f6', font: { family: 'Outfit' } }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#9ca3af', font: { family: 'Outfit' } }
          },
          y: {
            title: { display: true, text: 'Session-RPE (Carico)', color: '#00a8e8' },
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#9ca3af', font: { family: 'Outfit' } }
          },
          y1: {
            title: { display: true, text: 'Deviazione CMJ (%)', color: '#1e40af' },
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#9ca3af', font: { family: 'Outfit' } }
          }
        }
      }
    });
  }

  drawTeamReadinessChart(logsToday) {
    const ctx = document.getElementById('team-readiness-chart').getContext('2d');
    if (this.charts['team-readiness']) {
      this.charts['team-readiness'].destroy();
    }

    let sotto = 0, inMedia = 0, sopra = 0;

    logsToday.forEach(log => {
      const globalAvg = this.getPlayerGlobalAverageCmj(log.playerId);
      if (log.cmjHeight > 0 && globalAvg > 0) {
        const read = this.getReadinessStatus(log.cmjHeight, globalAvg);
        if (read.status === 'Sotto Media') sotto++;
        else if (read.status === 'Sopra Media') sopra++;
        else inMedia++;
      }
    });

    // If no logs, show empty chart helper
    if (sotto === 0 && inMedia === 0 && sopra === 0) {
      inMedia = 1; // placeholder to prevent crash
    }

    this.charts['team-readiness'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Sotto Media', 'In Media', 'Sopra Media'],
        datasets: [{
          data: [sotto, inMedia, sopra],
          backgroundColor: ['#ef4444', '#10b981', '#3b82f6'],
          borderColor: '#12151c',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { color: '#f3f4f6', font: { family: 'Outfit' } }
          }
        },
        cutout: '70%'
      }
    });
  }

  // 2. ROSTER (ROSA) VIEW RENDER
  renderRoster() {
    const grid = document.getElementById('roster-grid');
    grid.innerHTML = '';
    
    const searchVal = document.getElementById('roster-search').value.toLowerCase();
    
    const filteredPlayers = this.db.players.filter(p => 
      p.name.toLowerCase().includes(searchVal) || 
      p.role.toLowerCase().includes(searchVal)
    );

    if (filteredPlayers.length === 0) {
      grid.innerHTML = `<div class="card" style="grid-column: span 12; text-align: center; padding: 40px; color: var(--text-muted);">Nessun giocatrice corrispondente alla ricerca.</div>`;
      return;
    }

    filteredPlayers.forEach(p => {
      const initials = p.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
      
      let statusClass = 'badge-success';
      if (p.status === 'Infortunato') statusClass = 'badge-danger';
      else if (p.status === 'In recupero') statusClass = 'badge-warning';
      
      const lastCmjAvg = this.getPlayerGlobalAverageCmj(p.id);
      
      let injuryMarkup = '';
      if (p.status === 'Infortunato' || p.status === 'In recupero' || (p.injuryNotes && p.injuryNotes.trim() !== '')) {
        const notesText = p.injuryNotes && p.injuryNotes.trim() !== '' ? p.injuryNotes : 'Infortunio registrato';
        injuryMarkup = `
          <div style="margin-top: 10px; width: 100%; padding: 8px 10px; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; font-size: 11px; color: #f87171; text-align: left; line-height: 1.3;">
            <div style="font-weight: 600; display: flex; align-items: center; gap: 4px; margin-bottom: 3px; color: #ef4444;">
              <span>🏥 Infortunio:</span>
            </div>
            <div style="white-space: normal; word-break: break-word;">${notesText}</div>
          </div>
        `;
      }

      const card = document.createElement('div');
      card.className = 'player-card';
      card.innerHTML = `
        <div class="player-status-dot">
          <span class="badge ${statusClass}">${p.status}</span>
        </div>
        <div class="player-avatar">${initials}</div>
        <h3>${p.name}</h3>
        <span class="player-role-badge">${p.role}</span>
        
        <div class="player-mini-stats" style="grid-template-columns: 1fr; text-align: center;">
          <div class="mini-stat-item">
            <span class="mini-stat-lbl">CMJ Medio</span>
            <span class="mini-stat-val text-success" style="font-size: 16px;">${lastCmjAvg > 0 ? `${lastCmjAvg} cm` : 'N/D'}</span>
          </div>
        </div>
        ${injuryMarkup}
      `;
      
      card.addEventListener('click', () => this.openPlayerDetails(p.id));
      grid.appendChild(card);
    });
  }

  // PLAYER DETAILS DRAWER RENDER
  openPlayerDetails(playerId) {
    this.selectedPlayerId = playerId;
    const p = this.db.players.find(x => x.id === playerId);
    if (!p) return;

    const initials = p.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    
    // Header
    const avatar = document.getElementById('player-det-avatar');
    avatar.textContent = initials;
    document.getElementById('player-det-name').textContent = p.name;
    
    const roleBadge = document.getElementById('player-det-role');
    roleBadge.textContent = p.role;
    
    const statusBadge = document.getElementById('player-det-status');
    statusBadge.textContent = p.status;
    statusBadge.className = `badge ${p.status === 'Disponibile' ? 'badge-success' : p.status === 'Infortunato' ? 'badge-danger' : 'badge-warning'}`;

    // Anthropometrics & physiological
    const age = new Date().getFullYear() - new Date(p.birthDate).getFullYear();
    document.getElementById('player-det-phys').textContent = `${p.height} cm / ${p.weight} kg`;
    document.getElementById('player-det-age').textContent = `${age} anni (${p.birthDate})`;
    const fcEl = document.getElementById('player-det-fcmax');
    if (fcEl) fcEl.textContent = `${p.fcMax || '-'} bpm`;
    const vamEl = document.getElementById('player-det-vam');
    if (vamEl) vamEl.textContent = `${p.vam || '-'} km/h`;
    
    const globalAvgCmj = this.getPlayerGlobalAverageCmj(p.id);
    document.getElementById('player-det-cmj-avg').textContent = globalAvgCmj > 0 ? `${globalAvgCmj} cm` : 'N/D';

    // Populate injury details card
    const injuryCard = document.getElementById('player-det-injury-card');
    const injuryText = document.getElementById('player-det-injury-text');
    if (injuryCard && injuryText) {
      if (p.injuryNotes && p.injuryNotes.trim() !== '') {
        injuryText.textContent = p.injuryNotes;
        injuryCard.style.display = 'block';
      } else {
        injuryCard.style.display = 'none';
      }
    }

    // Activate Trends tab as default
    document.querySelectorAll('.drawer-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === 'det-trends') btn.classList.add('active');
      else btn.classList.remove('active');
    });
    document.querySelectorAll('.drawer-tab-content').forEach(content => {
      if (content.id === 'det-trends') content.classList.add('active');
      else content.classList.remove('active');
    });

    // Populate drawer tabs content
    this.renderPlayerTrends(p.id, globalAvgCmj);
    this.renderPlayerFvSquat(p.id);
    this.renderPlayerPhysicalTestsTable(p.id);

    // Open drawer
    document.getElementById('player-detail-drawer').classList.add('open');
  }

  renderPlayerTrends(playerId, globalAvgCmj) {
    const logs = this.db.dailyLogs.filter(l => l.playerId === playerId)
                                   .sort((a,b) => new Date(a.date) - new Date(b.date))
                                   .slice(-15); // Show last 15 recorded sessions

    const dates = logs.map(l => {
      const parts = l.date.split('-');
      return `${parts[2]}/${parts[1]}`;
    });
    
    const cmjValues = logs.map(l => l.cmjHeight);
    const workloads = logs.map(l => l.rpe * l.duration);
    const sleepHours = logs.map(l => l.sleepDuration);

    // 1. CMJ vs Average Chart
    const ctxCmj = document.getElementById('player-cmj-chart').getContext('2d');
    if (this.charts['player-cmj']) this.charts['player-cmj'].destroy();
    
    // Create reference line array
    const avgLine = Array(cmjValues.length).fill(globalAvgCmj);

    this.charts['player-cmj'] = new Chart(ctxCmj, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'CMJ Giornaliero (cm)',
            data: cmjValues,
            borderColor: '#00a8e8',
            backgroundColor: 'rgba(0, 168, 232, 0.1)',
            borderWidth: 3,
            pointBackgroundColor: '#00a8e8',
            pointRadius: 4,
            tension: 0.25
          },
          {
            label: 'Media Storica Giocatrice',
            data: avgLine,
            borderColor: '#ef4444',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#f3f4f6', font: { family: 'Outfit' } } }
        },
        scales: {
          x: { ticks: { color: '#9ca3af', font: { family: 'Outfit' } } },
          y: { 
            ticks: { color: '#9ca3af', font: { family: 'Outfit' } },
            title: { display: true, text: 'Altezza salto (cm)', color: '#f3f4f6' }
          }
        }
      }
    });

    // 2. Workload & Sleep Chart
    const ctxWork = document.getElementById('player-workload-chart').getContext('2d');
    if (this.charts['player-workload']) this.charts['player-workload'].destroy();

    this.charts['player-workload'] = new Chart(ctxWork, {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'Carico (Session-RPE)',
            data: workloads,
            backgroundColor: 'rgba(0, 168, 232, 0.45)',
            borderColor: '#00a8e8',
            borderWidth: 1.5,
            borderRadius: 4,
            yAxisID: 'y'
          },
          {
            label: 'Durata Sonno (ore)',
            data: sleepHours,
            type: 'line',
            borderColor: '#1e40af',
            pointBackgroundColor: '#1e40af',
            borderWidth: 2.5,
            tension: 0.1,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#f3f4f6', font: { family: 'Outfit' } } }
        },
        scales: {
          x: { ticks: { color: '#9ca3af', font: { family: 'Outfit' } } },
          y: { 
            ticks: { color: '#9ca3af', font: { family: 'Outfit' } },
            title: { display: true, text: 'Session-RPE', color: '#00a8e8' }
          },
          y1: { 
            position: 'right',
            ticks: { color: '#9ca3af', font: { family: 'Outfit' } },
            title: { display: true, text: 'Sonno (Ore)', color: '#1e40af' },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }

  renderPlayerFvSquat(playerId) {
    const fvPoints = this.db.squatProfiles[playerId] || [];
    const tableBody = document.getElementById('player-det-squat-table-body');
    tableBody.innerHTML = '';

    if (fvPoints.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="2" class="text-muted text-center">Nessun punto di profilazione inserito.</td></tr>`;
      
      // Clear regression chart if any
      if (this.charts['player-fv-chart']) this.charts['player-fv-chart'].destroy();
      document.getElementById('det-fv-1rm').textContent = '- kg';
      document.getElementById('det-fv-v0').textContent = '- m/s';
      document.getElementById('det-fv-eq').textContent = '-';
      document.getElementById('det-fv-profile-type').textContent = 'Nessun dato';
      return;
    }

    fvPoints.sort((a,b) => a.load - b.load).forEach(pt => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${pt.load} kg</td><td>${pt.velocity} m/s</td>`;
      tableBody.appendChild(row);
    });

    const reg = this.calculateLinearRegression(fvPoints);
    
    if (reg) {
      document.getElementById('det-fv-1rm').textContent = `${Math.round(reg.l0)} kg`;
      document.getElementById('det-fv-v0').textContent = `${Math.round(reg.v0 * 100) / 100} m/s`;
      document.getElementById('det-fv-eq').textContent = `v = ${Math.round(reg.m * 1000) / 1000}x + ${Math.round(reg.q * 100) / 100}`;
      
      // Profile type classification
      const profileBadge = document.getElementById('det-fv-profile-type');
      if (reg.m < -0.011) {
        profileBadge.textContent = 'Forza-Carente';
        profileBadge.className = 'badge badge-danger';
      } else if (reg.m > -0.007) {
        profileBadge.textContent = 'Velocità-Carente';
        profileBadge.className = 'badge badge-warning';
      } else {
        profileBadge.textContent = 'Profilo Bilanciato';
        profileBadge.className = 'badge badge-success';
      }

      // Draw linear regression chart in modal
      this.drawFvRegressionChart('player-fv-chart', fvPoints, reg);
    } else {
      if (this.charts['player-fv-chart']) this.charts['player-fv-chart'].destroy();
    }
  }

  renderPlayerPhysicalTestsTable(playerId) {
    const tests = this.db.physicalTests.filter(t => t.playerId === playerId)
                                         .sort((a,b) => new Date(b.date) - new Date(a.date)); // newest first
    const tableBody = document.getElementById('player-det-tests-table-body');
    tableBody.innerHTML = '';

    if (tests.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="3" class="text-muted text-center">Nessun test fisico registrato.</td></tr>`;
      return;
    }

    tests.forEach(t => {
      let unit = "cm";
      if (t.testType === "Sprint 30m") unit = "sec";
      else if (t.testType === "Yo-Yo IR1") unit = "metri";

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${t.date.split('-').reverse().join('/')}</td>
        <td><strong>${t.testType}</strong></td>
        <td>${t.value} ${unit}</td>
      `;
      tableBody.appendChild(row);
    });
  }

  // PLAYER ADD MODAL
  openPlayerModal() {
    document.getElementById('modal-player-id').value = '';
    document.getElementById('player-form').reset();
    document.getElementById('modal-player-title').textContent = 'Aggiungi giocatrice';
    
    // Set date of birth default (25 years ago)
    const dobDefault = new Date();
    dobDefault.setFullYear(dobDefault.getFullYear() - 25);
    document.getElementById('player-dob').value = dobDefault.toISOString().split('T')[0];

    document.getElementById('player-modal').classList.add('open');
  }

  closePlayerModal() {
    document.getElementById('player-modal').classList.remove('open');
  }

  playerFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('modal-player-id').value || 'p_' + Date.now();
    const name = document.getElementById('player-name').value;
    const role = document.getElementById('player-role').value;
    const status = document.getElementById('player-status').value;
    const birthDate = document.getElementById('player-dob').value;
    const height = parseInt(document.getElementById('player-height').value) || 0;
    const weight = parseInt(document.getElementById('player-weight').value) || 0;
    const injuryNotes = document.getElementById('player-injury-notes').value || '';

    const existingIdx = this.db.players.findIndex(x => x.id === id);

    if (existingIdx > -1) {
      // Edit
      this.db.players[existingIdx] = { ...this.db.players[existingIdx], id, name, role, status, birthDate, height, weight, injuryNotes };
      this.showToast(`Giocatrice ${name} aggiornata con successo!`);
    } else {
      // Add
      this.db.players.push({ id, name, role, status, birthDate, height, weight, injuryNotes });
      // initialize blank squat profile and loaded jump profile
      this.db.squatProfiles[id] = [];
      this.db.neuromuscularTests[id] = { cmj: [], sj: [] };
      this.showToast(`Nuova giocatrice ${name} inserita in rosa!`);
    }

    this.saveDatabase();
    this.closePlayerModal();
    this.renderRoster();
    this.renderDailyLog();
    this.renderDashboard();
  }

  editSelectedPlayer() {
    const playerId = this.selectedPlayerId;
    if (!playerId) return;
    const p = this.db.players.find(x => x.id === playerId);
    if (!p) return;

    // Popola i campi della modale
    document.getElementById('modal-player-id').value = p.id;
    document.getElementById('player-name').value = p.name;
    document.getElementById('player-role').value = p.role;
    document.getElementById('player-status').value = p.status;
    document.getElementById('player-dob').value = p.birthDate;
    document.getElementById('player-height').value = p.height || '';
    document.getElementById('player-weight').value = p.weight || '';
    document.getElementById('player-injury-notes').value = p.injuryNotes || '';

    // Imposta il titolo della modale coerente
    document.getElementById('modal-player-title').textContent = 'Modifica Dati Giocatrice';

    // Chiude il drawer laterale dei dettagli per evitare sovrapposizioni visive
    document.getElementById('player-detail-drawer').classList.remove('open');

    // Apre la modale di modifica
    document.getElementById('player-modal').classList.add('open');
  }

  deleteSelectedPlayer() {
    const playerId = this.selectedPlayerId;
    if (!playerId) return;
    const p = this.db.players.find(x => x.id === playerId);
    if (!p) return;

    if (confirm(`Sei sicuro di voler eliminare permanentemente l'Giocatrice ${p.name}?\n\nQuesta azione cancellerà tutti i suoi log di fatica, i test fisici, i salti e il profilo VBT di squat associati in modo irrecuperabile.`)) {
      
      // 1. Elimina oggetto Giocatrice
      this.db.players = this.db.players.filter(x => x.id !== playerId);

      // 2. Elimina i log giornalieri associati
      this.db.dailyLogs = this.db.dailyLogs.filter(x => x.playerId !== playerId);

      // 3. Elimina i test fisici associati (sprint, ecc.)
      this.db.physicalTests = this.db.physicalTests.filter(x => x.playerId !== playerId);

      // 4. Pulisci profili squat e salti neuromuscolari
      if (this.db.squatProfiles) {
        delete this.db.squatProfiles[playerId];
      }
      if (this.db.neuromuscularTests) {
        delete this.db.neuromuscularTests[playerId];
      }

      // Salva, chiudi e re-inizializza
      this.saveDatabase();
      document.getElementById('player-detail-drawer').classList.remove('open');
      this.selectedPlayerId = null;

      this.showToast(`giocatrice ${p.name} rimosso dalla rosa.`);
      this.renderRoster();
      this.renderDailyLog();
      this.renderDashboard();
    }
  }

  // 3. DAILY MONITORING INPUT VIEW RENDER
  renderDailyLog() {
    const selectedDate = document.getElementById('daily-log-date').value;
    const container = document.getElementById('daily-log-list');
    container.innerHTML = '';

    if (this.db.players.length === 0) {
      container.innerHTML = `<div class="card text-center" style="padding: 40px; color: var(--text-muted);">Nessun Giocatrice in rosa. Aggiungi Giocatrici per iniziare il monitoraggio.</div>`;
      return;
    }

    // Sort players alphabetically
    const sortedPlayers = [...this.db.players].sort((a,b) => a.name.localeCompare(b.name));

    sortedPlayers.forEach(p => {
      // Find log if already exists for this date
      const log = this.db.dailyLogs.find(l => l.date === selectedDate && l.playerId === p.id);
      
      const initials = p.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
      
      const isCompleted = log && log.cmjHeight > 0;
      
      const card = document.createElement('div');
      card.id = `row-${p.id}`;
      card.className = `daily-row-card ${isCompleted ? 'completed' : ''} ${p.status === 'Infortunato' ? 'injured' : ''}`;
      
      // Calculate baseline average for display preview
      const avgCmj = this.getPlayerGlobalAverageCmj(p.id);

      // Get initial readiness status
      const readiness = log && log.cmjHeight > 0 
        ? this.getReadinessStatus(log.cmjHeight, avgCmj) 
        : { status: 'N/D', deviation: 0, badgeClass: 'badge-secondary' };

      card.innerHTML = `
        <div class="daily-row-summary" onclick="app.toggleDailyRow('${p.id}')">
          <div class="daily-row-player-info">
            <div class="daily-row-avatar">${initials}</div>
            <div class="daily-row-details">
              <h4>${p.name}</h4>
              <span>Ruolo: ${p.role} | Stato: <strong>${p.status}</strong></span>
            </div>
          </div>

          <div class="daily-row-preview-badges" onclick="event.stopPropagation()">
            <div class="badge-item">
              <span class="badge-label">Readiness CMJ</span>
              <span class="badge badge-secondary" id="badge-readiness-${p.id}">N/D</span>
            </div>
            <div class="badge-item">
              <span class="badge-label">Fatica RPE (vs Media)</span>
              <span class="badge badge-secondary" id="badge-psycho-${p.id}">N/D</span>
            </div>
          </div>

          <button class="btn-toggle-row">
            <i data-lucide="chevron-down"></i>
          </button>
        </div>

        <div class="daily-row-inputs" id="inputs-${p.id}">
          <!-- Readiness CMJ -->
          <div class="form-group">
            <label>Salto CMJ Odierno (cm)</label>
            <div class="input-unit-wrapper">
              <input type="number" step="0.1" id="cmj-${p.id}" class="form-control" placeholder="es. 38" value="${log ? log.cmjHeight : ''}">
              <span class="input-unit">cm</span>
            </div>
            <span class="small-text text-muted" id="cmj-baseline-hint-${p.id}" style="margin-top: 4px;">
              Media globale: ${avgCmj > 0 ? `${avgCmj} cm` : 'Nuovo Giocatrice'}
            </span>
          </div>

          <!-- RPE Borg -->
          <div class="form-group">
            <label>Sforzo Percepito (RPE Borg CR10)</label>
            <select id="rpe-${p.id}" class="form-control">
              <option value="0" ${!log || log.rpe === 0 ? 'selected' : ''}>0 - Nessuno sforzo</option>
              <option value="1" ${log && log.rpe === 1 ? 'selected' : ''}>1 - Molto Leggero</option>
              <option value="2" ${log && log.rpe === 2 ? 'selected' : ''}>2 - Facile</option>
              <option value="3" ${log && log.rpe === 3 ? 'selected' : ''}>3 - Moderato</option>
              <option value="4" ${log && log.rpe === 4 ? 'selected' : ''}>4 - Abbastanza Duro</option>
              <option value="5" ${log && log.rpe === 5 ? 'selected' : ''}>5 - Duro</option>
              <option value="6" ${log && log.rpe === 6 ? 'selected' : ''}>6 - Duro+</option>
              <option value="7" ${log && log.rpe === 7 ? 'selected' : ''}>7 - Molto Duro</option>
              <option value="8" ${log && log.rpe === 8 ? 'selected' : ''}>8 - Molto Duro+</option>
              <option value="9" ${log && log.rpe === 9 ? 'selected' : ''}>9 - Estenuante</option>
              <option value="10" ${log && log.rpe === 10 ? 'selected' : ''}>10 - Sforzo Massimo</option>
            </select>
          </div>

          <!-- Duration -->
          <div class="form-group">
            <label>Durata Allenamento (minuti)</label>
            <div class="input-unit-wrapper">
              <input type="number" id="duration-${p.id}" class="form-control" placeholder="es. 90" value="${log ? log.duration : ''}">
              <span class="input-unit">min</span>
            </div>
          </div>

          <!-- Sleep Duration -->
          <div class="form-group">
            <label>Durata Sonno (ore)</label>
            <div class="input-unit-wrapper">
              <input type="number" step="0.5" id="sleep-h-${p.id}" class="form-control" placeholder="es. 8" value="${log ? log.sleepDuration : ''}">
              <span class="input-unit">ore</span>
            </div>
          </div>

          <!-- Sleep Quality -->
          <div class="form-group">
            <label>Qualità del Sonno</label>
            <select id="sleep-q-${p.id}" class="form-control">
              <option value="5" ${log && log.sleepQuality === 5 ? 'selected' : !log ? 'selected' : ''}>5 - Ottimo</option>
              <option value="4" ${log && log.sleepQuality === 4 ? 'selected' : ''}>4 - Buono</option>
              <option value="3" ${log && log.sleepQuality === 3 ? 'selected' : ''}>3 - Sufficiente</option>
              <option value="2" ${log && log.sleepQuality === 2 ? 'selected' : ''}>2 - Poco</option>
              <option value="1" ${log && log.sleepQuality === 1 ? 'selected' : ''}>1 - Insonnia</option>
            </select>
          </div>

          <!-- Muscle Soreness DOMS -->
          <div class="form-group">
            <label>Dolore Muscolare (DOMS)</label>
            <select id="doms-${p.id}" class="form-control">
              <option value="1" ${log && log.doms === 1 ? 'selected' : !log ? 'selected' : ''}>1 - Nessun Dolore</option>
              <option value="2" ${log && log.doms === 2 ? 'selected' : ''}>2 - Lieve Affaticamento</option>
              <option value="3" ${log && log.doms === 3 ? 'selected' : ''}>3 - Dolore Moderato</option>
              <option value="4" ${log && log.doms === 4 ? 'selected' : ''}>4 - Dolore Forte</option>
              <option value="5" ${log && log.doms === 5 ? 'selected' : ''}>5 - Dolore Invalidante</option>
            </select>
          </div>

          <!-- DOMS Notes -->
          <div class="form-group">
            <label>Note Dolori Muscolari</label>
            <input type="text" id="doms-notes-${p.id}" class="form-control" placeholder="es. Fastidio bicipite femorale" value="${log ? log.domsNotes || '' : ''}">
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    // Attach dynamic update event listeners to inputs (triggers calculation on all rows)
    sortedPlayers.forEach(p => {
      const cmjInput = document.getElementById(`cmj-${p.id}`);
      const rpeSelect = document.getElementById(`rpe-${p.id}`);
      const sleepQSelect = document.getElementById(`sleep-q-${p.id}`);
      const domsSelect = document.getElementById(`doms-${p.id}`);

      if (cmjInput) cmjInput.addEventListener('input', () => this.updateAllDailyBadges());
      if (rpeSelect) rpeSelect.addEventListener('change', () => this.updateAllDailyBadges());
      if (sleepQSelect) sleepQSelect.addEventListener('change', () => this.updateAllDailyBadges());
      if (domsSelect) domsSelect.addEventListener('change', () => this.updateAllDailyBadges());
    });

    // Compute and draw all badges on load
    this.updateAllDailyBadges();

    lucide.createIcons({ root: container });
  }

  toggleDailyRow(playerId) {
    const card = document.getElementById(`row-${playerId}`);
    card.classList.toggle('expanded');
  }

  fillDailyDefaults() {
    this.db.players.forEach(p => {
      // If player is injured, skip defaults
      if (p.status === 'Infortunato') return;

      const avgCmj = this.getPlayerGlobalAverageCmj(p.id) || 35;
      
      const cmjInput = document.getElementById(`cmj-${p.id}`);
      const rpeSelect = document.getElementById(`rpe-${p.id}`);
      const durInput = document.getElementById(`duration-${p.id}`);
      const sleepInput = document.getElementById(`sleep-h-${p.id}`);
      const sleepQSelect = document.getElementById(`sleep-q-${p.id}`);
      const domsSelect = document.getElementById(`doms-${p.id}`);
      const hrRipInput = document.getElementById(`hr-rip-${p.id}`);
      const hrMaxInput = document.getElementById(`hr-max-${p.id}`);

      // Only fill if empty
      if (cmjInput && !cmjInput.value) cmjInput.value = (avgCmj + (Math.random() - 0.5) * 1.5).toFixed(1);
      if (rpeSelect && rpeSelect.value === "0") rpeSelect.value = "4"; // Normal intensity session
      if (durInput && !durInput.value) durInput.value = "85";
      if (sleepInput && !sleepInput.value) sleepInput.value = "7.5";
      if (sleepQSelect && sleepQSelect.value === "5" && !sleepInput.value) sleepQSelect.value = "4"; // good
      if (domsSelect && domsSelect.value === "1") domsSelect.value = "2"; // light stiffness
      if (hrRipInput && !hrRipInput.value) hrRipInput.value = "54";
      if (hrMaxInput && !hrMaxInput.value) hrMaxInput.value = (p.fcMax - 10);
    });
    
    // Update all badges once at the end
    this.updateAllDailyBadges();
    this.showToast("Valori medi compilati per gli Giocatrici attivi!");
  }

  saveDailyLogs() {
    const selectedDate = document.getElementById('daily-log-date').value;
    let saveCount = 0;

    this.db.players.forEach(p => {
      const cmjVal = parseFloat(document.getElementById(`cmj-${p.id}`).value);
      const rpeVal = parseInt(document.getElementById(`rpe-${p.id}`).value);
      const durVal = parseInt(document.getElementById(`duration-${p.id}`).value) || 0;
      const sleepHVal = parseFloat(document.getElementById(`sleep-h-${p.id}`).value) || 0;
      const sleepQVal = parseInt(document.getElementById(`sleep-q-${p.id}`).value);
      const domsVal = parseInt(document.getElementById(`doms-${p.id}`).value);
      const domsNotesVal = document.getElementById(`doms-notes-${p.id}`).value;
      const hrRipVal = parseInt(document.getElementById(`hr-rip-${p.id}`).value) || 0;
      const hrMaxVal = parseInt(document.getElementById(`hr-max-${p.id}`).value) || 0;

      // Skip empty fields if they didn't input anything
      if (isNaN(cmjVal) && rpeVal === 0 && durVal === 0) {
        return; 
      }

      // Check if log already exists
      const logIdx = this.db.dailyLogs.findIndex(l => l.date === selectedDate && l.playerId === p.id);
      
      const logData = {
        id: logIdx > -1 ? this.db.dailyLogs[logIdx].id : `log_${p.id}_${selectedDate}`,
        date: selectedDate,
        playerId: p.id,
        cmjHeight: isNaN(cmjVal) ? 0 : cmjVal,
        rpe: rpeVal,
        duration: durVal,
        sleepQuality: sleepQVal,
        sleepDuration: sleepHVal,
        doms: domsVal,
        domsNotes: domsNotesVal,
        restingHR: hrRipVal,
        sessionHRMax: hrMaxVal
      };

      if (logIdx > -1) {
        this.db.dailyLogs[logIdx] = logData;
      } else {
        this.db.dailyLogs.push(logData);
      }
      saveCount++;
    });

    if (saveCount > 0) {
      this.saveDatabase();
      this.showToast(`Salvati ${saveCount} log Giocatrici per la data ${selectedDate}!`);
      this.renderDailyLog();
    } else {
      this.showToast("Nessun dato inserito. Compila almeno un Giocatrice prima di salvare.", "error");
    }
  }

  // 4. FORCE-VELOCITY PROFILE VIEW RENDER
  populatePlayerSelects() {
    const fvSelect = document.getElementById('fv-player-select');
    const testSelect = document.getElementById('test-player-select');
    
    // Save current selection values
    const currentFvVal = fvSelect.value;
    const currentTestVal = testSelect.value;

    // Clear and build options
    fvSelect.innerHTML = '';
    testSelect.innerHTML = '';

    // Sort players alphabetically
    const sorted = [...this.db.players].sort((a,b) => a.name.localeCompare(b.name));

    sorted.forEach(p => {
      const optionFv = document.createElement('option');
      optionFv.value = p.id;
      optionFv.textContent = `${p.name} (${p.role})`;
      fvSelect.appendChild(optionFv);

      const optionTest = document.createElement('option');
      optionTest.value = p.id;
      optionTest.textContent = `${p.name} (${p.role})`;
      testSelect.appendChild(optionTest);
    });

    // Restore selected values if still valid
    if (this.db.players.some(p => p.id === currentFvVal)) fvSelect.value = currentFvVal;
    if (this.db.players.some(p => p.id === currentTestVal)) testSelect.value = currentTestVal;
  }

  renderFvProfile() {
    const playerId = document.getElementById('fv-player-select').value;
    if (!playerId) {
      document.getElementById('fv-min-points-warning').textContent = "⚠️ Crea ed inserisci Giocatrici in rosa prima di procedere.";
      return;
    }

    const points = this.db.squatProfiles[playerId] || [];
    const pointsTable = document.getElementById('fv-active-points-body');
    pointsTable.innerHTML = '';

    // Reset results labels to default empty
    document.getElementById('fv-est-1rm').textContent = '- kg';
    document.getElementById('fv-est-v0').textContent = '- m/s';
    const slopeBadge = document.getElementById('fv-est-slope');
    slopeBadge.textContent = '-';
    
    const profileType = document.getElementById('fv-profile-type-badge');
    profileType.textContent = 'Inserisci dati';
    profileType.className = 'subtext';

    if (points.length === 0) {
      pointsTable.innerHTML = `<tr><td colspan="3" class="text-muted text-center">Nessun punto di prova registrato per questo Giocatrice.</td></tr>`;
      document.getElementById('fv-min-points-warning').style.display = 'block';
      if (this.charts['fv-regression-chart']) this.charts['fv-regression-chart'].destroy();
      return;
    }

    // Sort and display points
    const sortedPoints = [...points].sort((a,b) => a.load - b.load);
    sortedPoints.forEach(pt => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${pt.load} kg</strong></td>
        <td><strong>${pt.velocity} m/s</strong></td>
        <td>
          <button class="btn btn-danger btn-icon-only" style="width: 28px; height: 28px;" onclick="app.deleteFvPoint('${playerId}', ${pt.load})">
            &times;
          </button>
        </td>
      `;
      pointsTable.appendChild(row);
    });

    if (points.length < 2) {
      document.getElementById('fv-min-points-warning').style.display = 'block';
      if (this.charts['fv-regression-chart']) this.charts['fv-regression-chart'].destroy();
      return;
    }

    document.getElementById('fv-min-points-warning').style.display = 'none';

    // CALCULATE BIOMECHANICAL COEFFICIENTS
    const reg = this.calculateLinearRegression(points);
    if (reg) {
      document.getElementById('fv-est-1rm').textContent = `${Math.round(reg.l0)} kg`;
      document.getElementById('fv-est-v0').textContent = `${Math.round(reg.v0 * 100) / 100} m/s`;
      slopeBadge.textContent = `${Math.round(reg.m * 1000) / 1000}`;
      
      // Slope evaluation
      if (reg.m < -0.011) {
        profileType.textContent = 'Forza-Carente';
        profileType.className = 'subtext badge badge-danger';
      } else if (reg.m > -0.007) {
        profileType.textContent = 'Velocità-Carente';
        profileType.className = 'subtext badge badge-warning';
      } else {
        profileType.textContent = 'Profilo Bilanciato';
        profileType.className = 'subtext badge badge-success';
      }

      this.drawFvRegressionChart('fv-regression-chart', points, reg);
    }
  }

  handleFvSubmit(e) {
    e.preventDefault();
    const playerId = document.getElementById('fv-player-select').value;
    const load = parseInt(document.getElementById('fv-load').value);
    const velocity = parseFloat(document.getElementById('fv-velocity').value);

    if (!playerId) return;

    if (!this.db.squatProfiles[playerId]) {
      this.db.squatProfiles[playerId] = [];
    }

    // Check if point for this load already exists
    const existingIdx = this.db.squatProfiles[playerId].findIndex(p => p.load === load);
    if (existingIdx > -1) {
      this.db.squatProfiles[playerId][existingIdx].velocity = velocity;
    } else {
      this.db.squatProfiles[playerId].push({ load, velocity });
    }

    this.saveDatabase();
    document.getElementById('fv-load').value = '';
    document.getElementById('fv-velocity').value = '';
    
    this.renderFvProfile();
    this.showToast("Punto carico-velocità aggiunto!");
  }

  deleteFvPoint(playerId, load) {
    if (!this.db.squatProfiles[playerId]) return;
    
    this.db.squatProfiles[playerId] = this.db.squatProfiles[playerId].filter(pt => pt.load !== load);
    this.saveDatabase();
    this.renderFvProfile();
    this.showToast("Punto rimosso.");
  }

  calculateLinearRegression(points) {
    const n = points.length;
    if (n < 2) return null;

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = points[i].load;
      const y = points[i].velocity;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) return null;

    const m = (n * sumXY - sumX * sumY) / denominator;
    const q = (sumY - m * sumX) / n;

    const v0 = q; 
    const l0 = -q / m; // estimated 1RM when velocity = 0

    return { m, q, v0, l0 };
  }

  drawFvRegressionChart(canvasId, points, reg) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    // Sort points by load for scatter drawing
    const scatterPoints = points.map(pt => ({ x: pt.load, y: pt.velocity }));
    
    // Generate regression line endpoints
    const maxValX = Math.max(reg.l0 * 1.1, Math.max(...points.map(p => p.load)) * 1.2);
    const linePoints = [
      { x: 0, y: reg.v0 },
      { x: reg.l0, y: 0 },
      { x: maxValX, y: reg.m * maxValX + reg.q } // extend line
    ].filter(p => p.y >= 0); // only draw values above velocity=0

    this.charts[canvasId] = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Prove Misurate (Punti)',
            data: scatterPoints,
            backgroundColor: '#00a8e8',
            borderColor: '#008cc2',
            borderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8
          },
          {
            label: 'Retta F-V regressione',
            data: linePoints,
            type: 'line',
            borderColor: '#1e40af',
            borderWidth: 2,
            borderDash: [2, 2],
            pointRadius: 0,
            fill: false,
            showLine: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#f3f4f6', font: { family: 'Outfit' } } }
        },
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            title: { display: true, text: 'Carico / Forza (kg)', color: '#f3f4f6', font: { family: 'Outfit' } },
            ticks: { color: '#9ca3af', font: { family: 'Outfit' } },
            grid: { color: 'rgba(255,255,255,0.05)' },
            min: 0,
            max: Math.round(reg.l0 * 1.15)
          },
          y: {
            title: { display: true, text: 'Velocità Concentrica Media (m/s)', color: '#f3f4f6', font: { family: 'Outfit' } },
            ticks: { color: '#9ca3af', font: { family: 'Outfit' } },
            grid: { color: 'rgba(255,255,255,0.05)' },
            min: 0,
            max: Math.round((reg.v0 * 1.15) * 10) / 10
          }
        }
      }
    });
  }

  // 5. PHYSICAL TESTS VIEW RENDER
  renderPhysicalTests() {
    const tableBody = document.getElementById('test-history-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const filterType = document.getElementById('test-type-filter').value;
    const filterSearch = document.getElementById('test-history-search').value.toLowerCase();

    // Sort tests chronologically descending (newest first)
    const filteredTests = this.db.physicalTests.filter(t => {
      const player = this.db.players.find(p => p.id === t.playerId);
      const nameMatch = player ? player.name.toLowerCase().includes(filterSearch) : false;
      const typeMatch = filterType ? t.testType === filterType : true;
      return nameMatch && typeMatch;
    }).sort((a,b) => new Date(b.date) - new Date(a.date));

    if (filteredTests.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-muted text-center" style="padding: 20px;">Nessun test fisico trovato corrispondente ai filtri.</td></tr>`;
      return;
    }

    filteredTests.forEach(t => {
      const player = this.db.players.find(p => p.id === t.playerId);
      const playerName = player ? player.name : 'Sconosciuto';
      
      let unit = "cm";
      if (t.testType === "Sprint 30m") unit = "sec";
      else if (t.testType === "Yo-Yo IR1") unit = "metri";

      let displayVal = `<strong>${t.value} cm</strong>`;
      let details = [];
      if (t.testType === "Drop Jump") {
        if (t.dropHeight) details.push(`Caduta: ${t.dropHeight} cm`);
        if (t.rsi) details.push(`RSI: ${t.rsi}`);
        if (t.power) details.push(`Potenza: ${t.power} W`);
      } else if (t.power) {
        const powerLabel = t.testType.startsWith('CMJ') ? 'Picco' : 'Media';
        details.push(`${powerLabel}: ${t.power} W`);
      }

      if (details.length > 0) {
        displayVal += ` <span style="font-size: 11px; opacity: 0.85;">(${details.join(' | ')})</span>`;
      }

      let badgeText = t.testType;
      if (t.overload !== undefined && t.overload !== null && t.testType.includes("con Sovraccarico")) {
        const testName = t.testType.startsWith('CMJ') ? 'CMJ' : 'Squat Jump';
        badgeText = `${testName} (${t.overload} kg)`;
      }

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${t.date.split('-').reverse().join('/')}</td>
        <td><strong>${playerName}</strong></td>
        <td><span class="badge badge-purple">${badgeText}</span></td>
        <td>${displayVal}</td>
        <td>${unit}</td>
        <td>
          <button class="btn btn-danger btn-icon-only" style="width: 28px; height: 28px;" onclick="app.deletePhysicalTest('${t.id}')">
            &times;
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }

  togglePhysicalTestPowerField() {
    const select = document.getElementById('test-type-select');
    const jumpRow = document.getElementById('test-jump-row');
    const overloadGroup = document.getElementById('test-overload-group');
    const overloadInput = document.getElementById('test-overload');
    const dropHeightGroup = document.getElementById('test-drop-height-group');
    const dropHeightInput = document.getElementById('test-drop-height');
    const rsiGroup = document.getElementById('test-rsi-group');
    const rsiInput = document.getElementById('test-rsi');
    const powerGroup = document.getElementById('test-power-group');
    const label = document.getElementById('test-power-label');
    const input = document.getElementById('test-power');
    const unitLabel = document.getElementById('test-unit-label');
    
    if (!select || !jumpRow || !powerGroup || !label || !input) return;
    
    const val = select.value;
    if (unitLabel) unitLabel.textContent = 'cm';
    
    const isJump = val.startsWith('CMJ') || val.startsWith('Squat Jump') || val === 'Drop Jump';
    if (isJump) {
      jumpRow.style.display = 'flex';
      jumpRow.style.flexWrap = 'wrap';
      jumpRow.style.gap = '15px';
      
      if (val === 'Drop Jump') {
        if (overloadGroup) overloadGroup.style.display = 'none';
        if (dropHeightGroup) {
          dropHeightGroup.style.display = 'block';
          dropHeightGroup.className = 'form-group col-4';
        }
        if (rsiGroup) {
          rsiGroup.style.display = 'block';
          rsiGroup.className = 'form-group col-4';
        }
        if (powerGroup) {
          powerGroup.style.display = 'block';
          powerGroup.className = 'form-group col-4';
        }
        label.textContent = "Picco di Potenza (W)";
        input.placeholder = "es. 4100";
      } else if (val.includes('con Sovraccarico')) {
        if (overloadGroup) {
          overloadGroup.style.display = 'block';
          overloadGroup.className = 'form-group col-6';
        }
        if (dropHeightGroup) dropHeightGroup.style.display = 'none';
        if (rsiGroup) rsiGroup.style.display = 'none';
        if (powerGroup) {
          powerGroup.style.display = 'block';
          powerGroup.className = 'form-group col-6';
        }
        label.textContent = val.startsWith('CMJ') ? "Picco di Potenza (W)" : "Potenza Media Concentrica (W)";
        input.placeholder = "es. 3800";
      } else {
        if (overloadGroup) overloadGroup.style.display = 'none';
        if (dropHeightGroup) dropHeightGroup.style.display = 'none';
        if (rsiGroup) rsiGroup.style.display = 'none';
        if (powerGroup) {
          powerGroup.style.display = 'block';
          powerGroup.className = 'form-group col-12';
        }
        label.textContent = val.startsWith('CMJ') ? "Picco di Potenza (W)" : "Potenza Media Concentrica (W)";
        input.placeholder = "es. 4200";
      }
    } else {
      jumpRow.style.display = 'none';
    }
  }

  handlePhysicalTestSubmit(e) {
    e.preventDefault();
    const playerId = document.getElementById('test-player-select').value;
    const date = document.getElementById('test-date').value;
    const testType = document.getElementById('test-type-select').value;
    const value = parseFloat(document.getElementById('test-value').value);
    const powerInput = document.getElementById('test-power');
    const power = powerInput && powerInput.value ? parseInt(powerInput.value) : null;
    const overloadInput = document.getElementById('test-overload');
    const overload = overloadInput && overloadInput.value ? parseFloat(overloadInput.value) : null;
    const dropHeightInput = document.getElementById('test-drop-height');
    const dropHeight = dropHeightInput && dropHeightInput.value ? parseFloat(dropHeightInput.value) : null;
    const rsiInput = document.getElementById('test-rsi');
    const rsi = rsiInput && rsiInput.value ? parseFloat(rsiInput.value) : null;

    if (!playerId || !date || !testType || isNaN(value)) return;

    const testId = `test_${Date.now()}`;
    const isJump = testType.startsWith('CMJ') || testType.startsWith('Squat Jump') || testType === 'Drop Jump';
    
    this.db.physicalTests.push({
      id: testId,
      date,
      playerId,
      testType,
      value,
      power: isJump ? power : null,
      overload: (isJump && testType.includes('con Sovraccarico')) ? overload : null,
      dropHeight: testType === 'Drop Jump' ? dropHeight : null,
      rsi: testType === 'Drop Jump' ? rsi : null
    });

    // Se è un test CMJ o SJ, inseriamo i dati anche nell'archivio salti
    if (testType.startsWith('CMJ') || testType.startsWith('Squat Jump')) {
      if (!this.db.neuromuscularTests[playerId]) {
        this.db.neuromuscularTests[playerId] = { cmj: [], sj: [] };
      }
      
      let load = "A corpo libero";
      if (testType.includes("con Sovraccarico") && overload !== null) {
        load = `${overload} kg`;
      }
      
      const testEntry = { load, height: value };
      if (testType.startsWith('CMJ')) {
        testEntry.peakPower = power;
        this.db.neuromuscularTests[playerId].cmj.push(testEntry);
      } else {
        testEntry.meanPower = power;
        this.db.neuromuscularTests[playerId].sj.push(testEntry);
      }
    }

    this.saveDatabase();
    
    // Reset test inputs
    document.getElementById('test-value').value = '';
    if (powerInput) powerInput.value = '';
    if (overloadInput) overloadInput.value = '';
    
    this.renderPhysicalTests();
    this.showToast("Test prestazionale registrato correttamente!");
  }

  deletePhysicalTest(testId) {
    const testToDelete = this.db.physicalTests.find(t => t.id === testId);
    if (testToDelete) {
      const { playerId, testType, value, power, overload } = testToDelete;
      const isJump = testType.startsWith('CMJ') || testType.startsWith('Squat Jump');
      if (isJump) {
        const neuro = this.db.neuromuscularTests[playerId];
        if (neuro) {
          let load = "A corpo libero";
          if (testType.includes("con Sovraccarico") && overload !== null) {
            load = `${overload} kg`;
          }
          
          if (testType.startsWith('CMJ')) {
            neuro.cmj = (neuro.cmj || []).filter(item => !(item.height === value && item.peakPower === power && item.load === load));
          } else {
            neuro.sj = (neuro.sj || []).filter(item => !(item.height === value && item.meanPower === power && item.load === load));
          }
        }
      }
    }

    this.db.physicalTests = this.db.physicalTests.filter(t => t.id !== testId);
    this.saveDatabase();
    this.renderPhysicalTests();
    this.showToast("Test fisico eliminato.");
  }

  // 6. BACKUP & SYSTEM ACTIONS
  exportDatabase() {
    const filename = `soccer_team_db_backup_${new Date().toISOString().split('T')[0]}.json`;
    const jsonStr = JSON.stringify(this.db, null, 2);
    
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast("Backup scaricato con successo!");
  }

  exportMockDataJs() {
    const mockDataObj = {
      players: this.db.players,
      dailyLogs: this.db.dailyLogs,
      physicalTests: this.db.physicalTests,
      squatProfiles: this.db.squatProfiles,
      neuromuscularTests: this.db.neuromuscularTests,
      calendarEvents: this.db.calendarEvents,
      settings: this.db.settings || {
        teamName: "U.S. MOZZO",
        hubName: "sez. PALLAVOLO",
        logoUrl: "us_mozzo_logo.png"
      }
    };

    const fileContent = `// File Sincronizzato Rosa U.S. MOZZO PALLAVOLO\nconst generateMockData = () => {\n  return ${JSON.stringify(mockDataObj, null, 2)};\n};\n\nwindow.MOCK_DATA = generateMockData();\n`;

    const blob = new Blob([fileContent], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mock-data.js';
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast("File mock-data.js scaricato! Caricalo su GitHub per aggiornare le giocatrici sui cellulari.");
  }

  importDatabaseFile(file) {
    const reader = new FileReader();
    const msgDiv = document.getElementById('import-message');
    
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        
        // Simple structure validation
        if (!importedData.players || !importedData.dailyLogs || !importedData.physicalTests) {
          throw new Error("La struttura del file backup non è valida.");
        }

        this.db = importedData;
        this.saveDatabase();
        this.showToast("Database ripristinato con successo!");
        
        msgDiv.className = "text-success";
        msgDiv.textContent = `✅ Importazione completata: ${importedData.players.length} Giocatrici, ${importedData.dailyLogs.length} Log caricati.`;
        msgDiv.style.display = "block";
        
        // Refresh active views
        this.renderActiveTab();
      } catch (err) {
        msgDiv.className = "text-danger";
        msgDiv.textContent = `❌ Errore durante l'importazione: ${err.message}`;
        msgDiv.style.display = "block";
        this.showToast("File di backup non valido", "error");
      }
    };
    
    reader.readAsText(file);
  }

  // TOAST NOTIFICATIONS
  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
    
    const icon = type === 'error' ? 'alert-triangle' : 'check';
    
    toast.innerHTML = `
      <i data-lucide="${icon}"></i>
      <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    lucide.createIcons({ root: toast });

    // Slide out and remove toast after 3.5s
    setTimeout(() => {
      toast.style.animation = 'toastSlideIn 0.3s reverse forwards';
      setTimeout(() => {
        container.removeChild(toast);
      }, 300);
    }, 3500);
  }

  // 6. CARICHI NEUROMUSCOLARI (NEUROMUSCULAR LOADS) RENDER & ACTIONS
  getLoadAtVelocity(playerId, targetVelocity) {
    const points = this.db.squatProfiles[playerId] || [];
    if (points.length < 2) return null;
    
    const reg = this.calculateLinearRegression(points);
    if (!reg || reg.m >= 0) return null;
    
    const load = (targetVelocity - reg.q) / reg.m;
    if (load <= 0) return null;
    
    return Math.round(load);
  }

  renderNeuroLoads() {
    const grid = document.getElementById('neuro-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const searchInput = document.getElementById('neuro-search');
    const query = searchInput ? searchInput.value.toLowerCase() : '';

    const sortedPlayers = [...this.db.players].sort((a,b) => a.name.localeCompare(b.name));

    sortedPlayers.forEach(p => {
      if (query && !p.name.toLowerCase().includes(query) && !p.role.toLowerCase().includes(query)) {
        return;
      }

      // Initialize neuromuscularTests if not present
      if (!this.db.neuromuscularTests[p.id]) {
        this.db.neuromuscularTests[p.id] = { cmj: [], sj: [] };
      }

      const playerNeuro = this.db.neuromuscularTests[p.id];
      
      // Calculate best values for card preview
      let bestCmjPower = 0;
      let bestCmjLoad = '-';
      if (playerNeuro.cmj && playerNeuro.cmj.length > 0) {
        let maxPower = -1;
        playerNeuro.cmj.forEach(t => {
          const pwr = t.peakPower || 0;
          if (pwr > maxPower) {
            maxPower = pwr;
            bestCmjLoad = t.load;
            bestCmjPower = pwr;
          }
        });
      }

      let bestSjPower = 0;
      let bestSjLoad = '-';
      if (playerNeuro.sj && playerNeuro.sj.length > 0) {
        let maxPower = -1;
        playerNeuro.sj.forEach(t => {
          const pwr = t.meanPower || 0;
          if (pwr > maxPower) {
            maxPower = pwr;
            bestSjLoad = t.load;
            bestSjPower = pwr;
          }
        });
      }

      // Calculate squat loads at 0.5 and 0.7
      const loadAt07 = this.getLoadAtVelocity(p.id, 0.7);
      const loadAt05 = this.getLoadAtVelocity(p.id, 0.5);

      const initials = p.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

      const card = document.createElement('div');
      card.className = 'player-card';
      card.innerHTML = `
        <div class="player-avatar">${initials}</div>
        <h3>${p.name}</h3>
        <span class="player-role-badge">${p.role}</span>
        
        <div class="player-mini-stats" style="grid-template-columns: repeat(2, 1fr); margin-top: 12px; gap: 8px;">
          <div class="mini-stat-item">
            <span class="mini-stat-lbl">Carico CMJ (Max Picco)</span>
            <span class="mini-stat-val text-success" style="font-size: 13px;">
              ${bestCmjPower > 0 ? `<strong>${bestCmjLoad}</strong> <span style="font-size: 10px; font-weight: normal; opacity: 0.85;">(${bestCmjPower}W)</span>` : 'N/D'}
            </span>
          </div>
          <div class="mini-stat-item">
            <span class="mini-stat-lbl">Carico SJ (Max Media)</span>
            <span class="mini-stat-val text-info" style="font-size: 13px;">
              ${bestSjPower > 0 ? `<strong>${bestSjLoad}</strong> <span style="font-size: 10px; font-weight: normal; opacity: 0.85;">(${bestSjPower}W)</span>` : 'N/D'}
            </span>
          </div>
        </div>
        
        <div class="player-mini-stats" style="grid-template-columns: repeat(2, 1fr); margin-top: 8px; border-top: 1px dashed var(--border-color); padding-top: 8px; gap: 8px;">
          <div class="mini-stat-item">
            <span class="mini-stat-lbl">Squat @ 0.7 m/s</span>
            <span class="mini-stat-val text-primary" style="color: var(--primary); font-weight: 600;">${loadAt07 ? `${loadAt07} kg` : 'N/D'}</span>
          </div>
          <div class="mini-stat-item">
            <span class="mini-stat-lbl">Squat @ 0.5 m/s</span>
            <span class="mini-stat-val" style="color: var(--text-white); font-weight: 600;">${loadAt05 ? `${loadAt05} kg` : 'N/D'}</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => this.openNeuroDrawer(p.id));
      grid.appendChild(card);
    });
  }

  openNeuroDrawer(playerId) {
    this.selectedNeuroPlayerId = playerId;
    const p = this.db.players.find(x => x.id === playerId);
    if (!p) return;

    const initials = p.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

    document.getElementById('neuro-det-avatar').textContent = initials;
    document.getElementById('neuro-det-name').textContent = p.name;
    document.getElementById('neuro-det-role').textContent = p.role;

    // Calcola il carico allenante CMJ (max peakPower)
    let bestCmjLoad = 'N/D';
    let bestCmjPower = 0;
    const playerNeuro = this.db.neuromuscularTests[playerId] || { cmj: [], sj: [] };
    if (playerNeuro.cmj && playerNeuro.cmj.length > 0) {
      let maxPower = -1;
      playerNeuro.cmj.forEach(t => {
        const pwr = t.peakPower || 0;
        if (pwr > maxPower) {
          maxPower = pwr;
          bestCmjLoad = t.load;
          bestCmjPower = pwr;
        }
      });
    }

    // Calcola il carico allenante SJ (max meanPower)
    let bestSjLoad = 'N/D';
    let bestSjPower = 0;
    if (playerNeuro.sj && playerNeuro.sj.length > 0) {
      let maxPower = -1;
      playerNeuro.sj.forEach(t => {
        const pwr = t.meanPower || 0;
        if (pwr > maxPower) {
          maxPower = pwr;
          bestSjLoad = t.load;
          bestSjPower = pwr;
        }
      });
    }

    // Calculate and render VBT target loads at 0.5 and 0.7
    const loadAt07 = this.getLoadAtVelocity(playerId, 0.7);
    const loadAt05 = this.getLoadAtVelocity(playerId, 0.5);
    const vbtBox = document.getElementById('neuro-det-vbt-box');
    if (vbtBox) {
      vbtBox.innerHTML = `
        <div class="stat-card" style="padding: 12px; background: rgba(0, 168, 232, 0.05); border: 1px solid rgba(0, 168, 232, 0.2);">
          <span class="stat-label" style="font-size: 10px; text-transform: uppercase;">Squat VBT @ 0.7 m/s</span>
          <h3 class="stat-value" style="font-size: 16px; margin-top: 4px; color: var(--primary);">${loadAt07 ? `${loadAt07} kg` : 'N/D'}</h3>
          <span class="text-muted" style="font-size: 10px;">Obiettivo: Velocità</span>
        </div>
        <div class="stat-card" style="padding: 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color);">
          <span class="stat-label" style="font-size: 10px; text-transform: uppercase;">Squat VBT @ 0.5 m/s</span>
          <h3 class="stat-value" style="font-size: 16px; margin-top: 4px; color: var(--text-white);">${loadAt05 ? `${loadAt05} kg` : 'N/D'}</h3>
          <span class="text-muted" style="font-size: 10px;">Obiettivo: Forza</span>
        </div>
        <div class="stat-card" style="padding: 12px; background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2);">
          <span class="stat-label" style="font-size: 10px; text-transform: uppercase;">Carico Allenante CMJ</span>
          <h3 class="stat-value" style="font-size: 16px; margin-top: 4px; color: var(--success);">${bestCmjLoad !== 'N/D' ? bestCmjLoad : 'N/D'}</h3>
          <span class="text-muted" style="font-size: 10px;">Max Picco: ${bestCmjPower > 0 ? `${bestCmjPower} W` : '-'}</span>
        </div>
        <div class="stat-card" style="padding: 12px; background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.2);">
          <span class="stat-label" style="font-size: 10px; text-transform: uppercase;">Carico Allenante SJ</span>
          <h3 class="stat-value" style="font-size: 16px; margin-top: 4px; color: var(--secondary);">${bestSjLoad !== 'N/D' ? bestSjLoad : 'N/D'}</h3>
          <span class="text-muted" style="font-size: 10px;">Max Media: ${bestSjPower > 0 ? `${bestSjPower} W` : '-'}</span>
        </div>
      `;
    }

    // Reset Form
    document.getElementById('neuro-test-form').reset();
    this.toggleNeuroFormFields();

    // Render Jumps Tables
    this.renderNeuroTables(playerId);

    // Open Drawer
    document.getElementById('neuro-detail-drawer').classList.add('open');
  }

  closeNeuroDrawer() {
    document.getElementById('neuro-detail-drawer').classList.remove('open');
    this.selectedNeuroPlayerId = null;
  }

  toggleNeuroFormFields() {
    const type = document.getElementById('neuro-type').value;
    const label = document.getElementById('neuro-power-label');
    const input = document.getElementById('neuro-power');

    if (type === 'CMJ') {
      label.textContent = "Picco di Potenza (W)";
      input.placeholder = "es. 4200";
    } else {
      label.textContent = "Potenza Media Concentrica (W)";
      input.placeholder = "es. 2900";
    }
  }

  handleNeuroTestSubmit(e) {
    e.preventDefault();
    const playerId = this.selectedNeuroPlayerId;
    if (!playerId) return;

    const type = document.getElementById('neuro-type').value;
    const load = document.getElementById('neuro-load').value.trim();
    const height = parseFloat(document.getElementById('neuro-height').value);
    const power = parseInt(document.getElementById('neuro-power').value);

    if (!load || isNaN(height) || isNaN(power)) return;

    if (!this.db.neuromuscularTests[playerId]) {
      this.db.neuromuscularTests[playerId] = { cmj: [], sj: [] };
    }

    const testEntry = { load, height };
    if (type === 'CMJ') {
      testEntry.peakPower = power;
      this.db.neuromuscularTests[playerId].cmj.push(testEntry);
    } else {
      testEntry.meanPower = power;
      this.db.neuromuscularTests[playerId].sj.push(testEntry);
    }

    this.saveDatabase();
    this.showToast("Test di salto neuromuscolare registrato con successo!");
    
    // Clear inputs except select
    document.getElementById('neuro-load').value = '';
    document.getElementById('neuro-height').value = '';
    document.getElementById('neuro-power').value = '';

    // Re-render
    this.renderNeuroTables(playerId);
    this.renderNeuroLoads();
  }

  deleteNeuroTest(type, index) {
    const playerId = this.selectedNeuroPlayerId;
    if (!playerId || !this.db.neuromuscularTests[playerId]) return;

    if (type === 'cmj') {
      this.db.neuromuscularTests[playerId].cmj.splice(index, 1);
    } else {
      this.db.neuromuscularTests[playerId].sj.splice(index, 1);
    }

    this.saveDatabase();
    this.showToast("Test eliminato.");
    this.renderNeuroTables(playerId);
    this.renderNeuroLoads();
  }

  renderNeuroTables(playerId) {
    const playerNeuro = this.db.neuromuscularTests[playerId] || { cmj: [], sj: [] };
    const cmjBody = document.getElementById('neuro-cmj-table-body');
    const sjBody = document.getElementById('neuro-sj-table-body');

    if (!cmjBody || !sjBody) return;

    cmjBody.innerHTML = '';
    sjBody.innerHTML = '';

    // 1. Render CMJ (Highlighting best peakPower)
    const cmjList = playerNeuro.cmj || [];
    let bestCmjIdx = -1;
    let maxCmjPower = -1;

    cmjList.forEach((t, idx) => {
      const power = t.peakPower || 0;
      if (power > maxCmjPower) {
        maxCmjPower = power;
        bestCmjIdx = idx;
      }
    });

    if (cmjList.length === 0) {
      cmjBody.innerHTML = `<tr><td colspan="5" class="text-muted text-center">Nessun salto CMJ registrato per questo Giocatrice.</td></tr>`;
    } else {
      cmjList.forEach((t, idx) => {
        const isBest = idx === bestCmjIdx && maxCmjPower > 0;
        const rowStyle = isBest ? 'style="background: rgba(0, 168, 232, 0.08); border-left: 3px solid var(--primary); font-weight: 600;"' : '';
        const badgeMarkup = isBest ? '<span class="badge badge-success">⭐ Migliore (Picco)</span>' : '<span class="text-muted small-text">Regolare</span>';
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td ${rowStyle}>${t.load}</td>
          <td ${rowStyle}>${t.height} cm</td>
          <td ${rowStyle}><strong>${t.peakPower || 0} W</strong></td>
          <td ${rowStyle}>${badgeMarkup}</td>
          <td ${rowStyle} style="text-align: center;">
            <button class="btn btn-danger btn-icon-only" style="width: 24px; height: 24px; padding: 0;" onclick="app.deleteNeuroTest('cmj', ${idx})">&times;</button>
          </td>
        `;
        cmjBody.appendChild(row);
      });
    }

    // 2. Render SJ (Highlighting best meanPower)
    const sjList = playerNeuro.sj || [];
    let bestSjIdx = -1;
    let maxSjPower = -1;

    sjList.forEach((t, idx) => {
      const power = t.meanPower || 0;
      if (power > maxSjPower) {
        maxSjPower = power;
        bestSjIdx = idx;
      }
    });

    if (sjList.length === 0) {
      sjBody.innerHTML = `<tr><td colspan="5" class="text-muted text-center">Nessun salto SJ registrato per questo Giocatrice.</td></tr>`;
    } else {
      sjList.forEach((t, idx) => {
        const isBest = idx === bestSjIdx && maxSjPower > 0;
        const rowStyle = isBest ? 'style="background: rgba(30, 64, 175, 0.12); border-left: 3px solid var(--secondary); font-weight: 600;"' : '';
        const badgeMarkup = isBest ? '<span class="badge badge-info" style="background-color: var(--secondary);">⭐ Migliore (Media)</span>' : '<span class="text-muted small-text">Regolare</span>';

        const row = document.createElement('tr');
        row.innerHTML = `
          <td ${rowStyle}>${t.load}</td>
          <td ${rowStyle}>${t.height} cm</td>
          <td ${rowStyle}><strong>${t.meanPower || 0} W</strong></td>
          <td ${rowStyle}>${badgeMarkup}</td>
          <td ${rowStyle} style="text-align: center;">
            <button class="btn btn-danger btn-icon-only" style="width: 24px; height: 24px; padding: 0;" onclick="app.deleteNeuroTest('sj', ${idx})">&times;</button>
          </td>
        `;
        sjBody.appendChild(row);
      });
    }
  }

  // 7. CARICHI AEROBICI (VAM AEROBIC LOADS) RENDER & ACTIONS
  renderAerobicLoads() {
    const container = document.getElementById('aerobic-list');
    if (!container) return;
    container.innerHTML = '';

    const searchInput = document.getElementById('aerobic-search');
    const query = searchInput ? searchInput.value.toLowerCase() : '';

    const sortedPlayers = [...this.db.players].sort((a,b) => a.name.localeCompare(b.name));

    sortedPlayers.forEach(p => {
      if (query && !p.name.toLowerCase().includes(query) && !p.role.toLowerCase().includes(query)) {
        return;
      }

      const initials = p.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

      const card = document.createElement('div');
      card.id = `aerobic-row-${p.id}`;
      card.className = 'daily-row-card';
      
      const percentages = [100, 105, 110, 115, 120, 125, 130];
      const vamKmh = parseFloat(p.vam) || 0;
      const vamMps = vamKmh / 3.6;

      let tableRows = '';
      percentages.forEach(pct => {
        const speedPct = (vamMps * (pct / 100));
        const dist10s = speedPct * 10;
        const dist15s = speedPct * 15;
        const dist20s = speedPct * 20;

        tableRows += `
          <tr>
            <td><strong>${pct}%</strong></td>
            <td>${speedPct.toFixed(2)} m/s</td>
            <td><strong>${dist10s.toFixed(1)} m</strong></td>
            <td><strong>${dist15s.toFixed(1)} m</strong></td>
            <td><strong>${dist20s.toFixed(1)} m</strong></td>
          </tr>
        `;
      });

      card.innerHTML = `
        <div class="daily-row-summary" onclick="app.toggleAerobicCard('${p.id}')">
          <div class="daily-row-player-info">
            <div class="daily-row-avatar">${initials}</div>
            <div class="daily-row-details">
              <h4>${p.name}</h4>
              <span>Ruolo: ${p.role}</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; margin-right: 20px;" onclick="event.stopPropagation()">
            <label style="margin: 0; font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">VAM:</label>
            <div class="input-unit-wrapper" style="width: 100px;">
              <input type="number" step="0.1" min="10" max="25" id="vam-edit-${p.id}" class="form-control" value="${p.vam}" oninput="app.updatePlayerVam('${p.id}')" style="height: 32px; padding: 4px 8px; font-size: 13px;">
              <span class="input-unit" style="font-size: 10px; right: 8px;">km/h</span>
            </div>
          </div>

          <button class="btn-toggle-row">
            <i data-lucide="chevron-down"></i>
          </button>
        </div>

        <div class="daily-row-inputs" id="aerobic-details-${p.id}" style="padding: 20px; display: none;">
          <div class="card-table-wrapper" style="margin-top: 5px;">
            <div class="card-header" style="border-bottom: 1px solid var(--border-color); padding: 12px 16px;">
              <h4 style="margin: 0; font-size: 13px; color: var(--primary);">Tabella Distanze Ripetute Intermittenti (VAM: ${vamKmh.toFixed(1)} km/h)</h4>
            </div>
            <table class="data-table small-table">
              <thead>
                <tr>
                  <th>Percentuale VAM</th>
                  <th>Velocità (m/s)</th>
                  <th>Distanza (10s)</th>
                  <th>Distanza (15s)</th>
                  <th>Distanza (20s)</th>
                </tr>
              </thead>
              <tbody id="vam-table-body-${p.id}">
                ${tableRows}
              </tbody>
            </table>
          </div>
        </div>
      `;

      container.appendChild(card);
    });

    lucide.createIcons({ root: container });
  }

  toggleAerobicCard(playerId) {
    const details = document.getElementById(`aerobic-details-${playerId}`);
    const card = document.getElementById(`aerobic-row-${playerId}`);
    if (details) {
      if (details.style.display === 'none') {
        details.style.display = 'block';
        card.classList.add('expanded');
      } else {
        details.style.display = 'none';
        card.classList.remove('expanded');
      }
    }
  }

  updatePlayerVam(playerId) {
    const input = document.getElementById(`vam-edit-${playerId}`);
    if (!input) return;

    const val = parseFloat(input.value);
    if (isNaN(val) || val < 5 || val > 30) return;

    // Update in database
    const player = this.db.players.find(p => p.id === playerId);
    if (player) {
      player.vam = val;
      this.saveDatabase();
      
      // Update table rows locally for instant feedback
      const tableBody = document.getElementById(`vam-table-body-${playerId}`);
      if (tableBody) {
        const percentages = [100, 105, 110, 115, 120, 125, 130];
        const vamMps = val / 3.6;
        let tableRows = '';
        percentages.forEach(pct => {
          const speedPct = (vamMps * (pct / 100));
          const dist10s = speedPct * 10;
          const dist15s = speedPct * 15;
          const dist20s = speedPct * 20;

          tableRows += `
            <tr>
              <td><strong>${pct}%</strong></td>
              <td>${speedPct.toFixed(2)} m/s</td>
              <td><strong>${dist10s.toFixed(1)} m</strong></td>
              <td><strong>${dist15s.toFixed(1)} m</strong></td>
              <td><strong>${dist20s.toFixed(1)} m</strong></td>
            </tr>
          `;
        });
        tableBody.innerHTML = tableRows;
        
        // Update header VAM title
        const header = tableBody.closest('.card-table-wrapper').querySelector('.card-header h4');
        if (header) {
          header.textContent = `Tabella Distanze Ripetute Intermittenti (VAM: ${val.toFixed(1)} km/h)`;
        }
      }
    }
  }

  // 8. Portale Giocatrici (PLAYER PORTAL & CSV IMPORTS) ACTIONS
  getEncodedRosterParam() {
    if (!this.db || !Array.isArray(this.db.players) || this.db.players.length === 0) return '';
    try {
      const compact = this.db.players.map(p => ({
        id: p.id,
        name: p.name,
        role: p.role,
        status: p.status || 'Disponibile'
      }));
      const jsonStr = JSON.stringify(compact);
      return '&roster=' + encodeURIComponent(btoa(unescape(encodeURIComponent(jsonStr))));
    } catch (e) {
      return '';
    }
  }

  decodeRosterParam() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const rosterParam = urlParams.get('roster');
      if (rosterParam) {
        const jsonStr = decodeURIComponent(escape(atob(decodeURIComponent(rosterParam))));
        const players = JSON.parse(jsonStr);
        if (Array.isArray(players) && players.length > 0) {
          if (!this.db) {
            this.db = { players: [], dailyLogs: [], physicalTests: [], squatProfiles: {}, neuromuscularTests: {}, calendarEvents: [] };
          }
          // Sostituisce completamente la rosa del telefono con quella esatta inviata nel QR Code
          this.db.players = players;
          this.saveDatabase(true);
        }
      }
    } catch(e) {
      console.error("Errore decodifica roster da URL:", e);
    }
  }

  initPortalUrls() {
    let cleanUrl = window.location.href.split('?')[0];
    const isLocal = window.location.protocol === 'file:';
    
    // Mostra/nasconde l'avviso di caricamento locale offline
    const warnRpe = document.getElementById('local-warning-rpe');
    const warnRec = document.getElementById('local-warning-recovery');
    if (warnRpe) warnRpe.style.display = isLocal ? 'block' : 'none';
    if (warnRec) warnRec.style.display = isLocal ? 'block' : 'none';

    if (isLocal) {
      cleanUrl = 'https://nasattialice-max.github.io/gestione-monitoraggio/index.html';
    }

    const rosterParam = this.getEncodedRosterParam();
    const defaultRpe = cleanUrl + '?kiosk=rpe' + rosterParam;
    const defaultRec = cleanUrl + '?kiosk=recovery' + rosterParam;

    const rpeInput = document.getElementById('config-url-rpe');
    const recInput = document.getElementById('config-url-recovery');
    
    if (rpeInput) rpeInput.value = defaultRpe;
    if (recInput) recInput.value = defaultRec;
    
    this.generatePortalQrs();
    this.setupCsvDragAndDrop();
  }
  
  savePortalUrls() {
    const rpeInput = document.getElementById('config-url-rpe');
    const recInput = document.getElementById('config-url-recovery');
    
    let rpeUrl = rpeInput ? rpeInput.value.trim() : '';
    let recUrl = recInput ? recInput.value.trim() : '';
    
    localStorage.setItem('portal_url_rpe', rpeUrl);
    localStorage.setItem('portal_url_recovery', recUrl);
    
    // Se l'utente ha cancellato il link, ricalcola e mostra il link di default del portale
    let cleanUrl = window.location.href.split('?')[0];
    if (window.location.protocol === 'file:') {
      cleanUrl = 'https://nasattialice-max.github.io/gestione-monitoraggio/index.html';
    }
    const rosterParam = this.getEncodedRosterParam();
    const defaultRpe = cleanUrl + '?kiosk=rpe' + rosterParam;
    const defaultRec = cleanUrl + '?kiosk=recovery' + rosterParam;
    
    if (!rpeUrl && rpeInput) rpeInput.value = defaultRpe;
    if (!recUrl && recInput) recInput.value = defaultRec;
    
    this.generatePortalQrs();
    this.showToast("Link dei moduli salvati con successo!");
  }
  
  generatePortalQrs(forceReset = false) {
    let cleanUrl = window.location.href.split('?')[0];
    const isLocal = window.location.protocol === 'file:';
    
    if (isLocal) {
      cleanUrl = 'https://nasattialice-max.github.io/gestione-monitoraggio/index.html';
    }

    const rosterParam = this.getEncodedRosterParam();
    const defaultRpe = cleanUrl + '?kiosk=rpe' + rosterParam;
    const defaultRec = cleanUrl + '?kiosk=recovery' + rosterParam;

    const rpeInput = document.getElementById('config-url-rpe');
    const recInput = document.getElementById('config-url-recovery');

    if (forceReset || (rpeInput && rpeInput.value.includes('&roster='))) {
      localStorage.removeItem('portal_url_rpe');
      localStorage.removeItem('portal_url_recovery');
      if (rpeInput) rpeInput.value = defaultRpe;
      if (recInput) recInput.value = defaultRec;
    } else {
      if (rpeInput && !rpeInput.value) rpeInput.value = defaultRpe;
      if (recInput && !recInput.value) recInput.value = defaultRec;
    }

    const rpeUrl = (rpeInput && rpeInput.value) ? rpeInput.value : defaultRpe;
    const recUrl = (recInput && recInput.value) ? recInput.value : defaultRec;
    
    const rpeContainer = document.getElementById('qr-rpe-container');
    const recContainer = document.getElementById('qr-recovery-container');
    
    if (!rpeContainer || !recContainer) return;
    
    rpeContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(rpeUrl)}" style="border: 6px solid white; border-radius: 4px; display: block; box-shadow: 0 4px 12px rgba(0,0,0,0.35);" alt="QR Code RPE">`;
    recContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(recUrl)}" style="border: 6px solid white; border-radius: 4px; display: block; box-shadow: 0 4px 12px rgba(0,0,0,0.35);" alt="QR Code Recovery">`;
    
    if (forceReset) {
      this.showToast("QR Code e link aggiornati con la rosa corrente!");
    }
  }

  copyPortalUrl(type) {
    const inputId = type === 'rpe' ? 'config-url-rpe' : 'config-url-recovery';
    const input = document.getElementById(inputId);
    if (!input) return;
    
    input.select();
    input.setSelectionRange(0, 99999); // Mobile
    
    try {
      navigator.clipboard.writeText(input.value)
        .then(() => {
          this.showToast("Link copiato negli appunti!");
        })
        .catch(() => {
          document.execCommand('copy');
          this.showToast("Link copiato negli appunti!");
        });
    } catch (e) {
      document.execCommand('copy');
      this.showToast("Link copiato negli appunti!");
    }
  }

  testPortalUrl(type) {
    const isLocal = window.location.protocol === 'file:';
    const mode = type === 'rpe' ? 'post-workout' : 'morning-recovery';
    
    if (isLocal) {
      this.startKiosk(mode);
      this.showToast("Avvio modulo di test offline...");
    } else {
      const inputId = type === 'rpe' ? 'config-url-rpe' : 'config-url-recovery';
      const input = document.getElementById(inputId);
      if (input && input.value) {
        window.open(input.value, '_blank');
        this.showToast("Apertura link di test in corso...");
      } else {
        this.startKiosk(mode);
      }
    }
  }
  
  setupCsvDragAndDrop() {
    const rpeZone = document.getElementById('csv-rpe-zone');
    const recZone = document.getElementById('csv-recovery-zone');
    const rosterZone = document.getElementById('csv-roster-zone');
    const rpeInput = document.getElementById('csv-rpe-input');
    const recInput = document.getElementById('csv-recovery-input');
    const rosterInput = document.getElementById('csv-roster-input');
    
    if (!rpeZone || !recZone || !rosterZone || !rpeInput || !recInput || !rosterInput) return;
    
    rpeZone.onclick = () => rpeInput.click();
    rpeInput.onchange = (e) => {
      if (e.target.files.length > 0) this.handleCsvFile(e.target.files[0], 'rpe');
    };
    
    recZone.onclick = () => recInput.click();
    recInput.onchange = (e) => {
      if (e.target.files.length > 0) this.handleCsvFile(e.target.files[0], 'recovery');
    };

    rosterZone.onclick = () => rosterInput.click();
    rosterInput.onchange = (e) => {
      if (e.target.files.length > 0) this.handleCsvFile(e.target.files[0], 'roster');
    };
    
    [
      { zone: rpeZone, type: 'rpe' },
      { zone: recZone, type: 'recovery' },
      { zone: rosterZone, type: 'roster' }
    ].forEach(item => {
      const { zone, type } = item;
      
      zone.ondragover = (e) => {
        e.preventDefault();
        zone.style.borderColor = 'var(--primary)';
        zone.style.background = 'rgba(0, 168, 232, 0.05)';
      };
      
      zone.ondragleave = () => {
        zone.style.borderColor = 'var(--border-color)';
        zone.style.background = 'transparent';
      };
      
      zone.ondrop = (e) => {
        e.preventDefault();
        zone.style.borderColor = 'var(--border-color)';
        zone.style.background = 'transparent';
        
        if (e.dataTransfer.files.length > 0) {
          this.handleCsvFile(e.dataTransfer.files[0], type);
        }
      };
    });
  }

  parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];
    
    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.includes(';')) delimiter = ';';
    else if (firstLine.includes('\t')) delimiter = '\t';
    
    const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase());
    const hasHeaders = headers.some(h => 
      h.includes('nome') || h.includes('Giocatrice') || h.includes('Giocatrice') || h.includes('rpe') || h.includes('sleep') || h.includes('sonno')
    );
    
    const rows = [];
    const startIndex = hasHeaders ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length === 0 || cols[0] === '') continue;
      
      const rowData = {};
      if (hasHeaders) {
        headers.forEach((h, idx) => {
          rowData[h] = cols[idx];
        });
      } else {
        cols.forEach((val, idx) => {
          rowData[idx] = val;
        });
      }
      rows.push(rowData);
    }
    
    return { rows, hasHeaders, headers };
  }

  handleCsvFile(file, type) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const parsed = this.parseCsv(text);
      if (parsed.rows.length === 0) {
        this.showToast("Il file CSV caricato è vuoto o non valido.", "error");
        return;
      }
      
      let importCount = 0;
      const todayStr = new Date().toISOString().split('T')[0];
      
      parsed.rows.forEach(row => {
        if (type === 'roster') {
          let name = '';
          let role = 'Centrocampista';
          let status = 'Disponibile';
          let height = 180;
          let weight = 75;
          let birthDate = todayStr;
          let fcMax = 190;
          let vam = 16.0;
          
          if (parsed.hasHeaders) {
            const nameKey = Object.keys(row).find(k => k.includes('nome') || k.includes('name') || k.includes('giocatrice') || k.includes('Giocatrice'));
            if (nameKey) name = row[nameKey];
            
            const roleKey = Object.keys(row).find(k => k.includes('ruol') || k.includes('role') || k.includes('posiz'));
            if (roleKey && row[roleKey]) {
              const r = row[roleKey].toLowerCase();
              if (r.includes('port') || r.includes('goalk')) role = 'Portiere';
              else if (r.includes('dif') || r.includes('def')) role = 'Difensore';
              else if (r.includes('centr') || r.includes('midf')) role = 'Centrocampista';
              else if (r.includes('att') || r.includes('forw') || r.includes('strik')) role = 'Attaccante';
            }
            
            const hKey = Object.keys(row).find(k => k.includes('altez') || k.includes('height') || k.includes('cm'));
            if (hKey) height = parseInt(row[hKey]) || 180;
            
            const wKey = Object.keys(row).find(k => k.includes('peso') || k.includes('weight') || k.includes('kg'));
            if (wKey) weight = parseInt(row[wKey]) || 75;
            
            const bKey = Object.keys(row).find(k => k.includes('nasc') || k.includes('birth') || k.includes('dob') || k.includes('complean'));
            if (bKey && row[bKey]) {
              const matchEU = row[bKey].match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
              if (matchEU) {
                birthDate = `${matchEU[3]}-${matchEU[2].padStart(2, '0')}-${matchEU[1].padStart(2, '0')}`;
              } else {
                birthDate = row[bKey];
              }
            }
            
            const fcKey = Object.keys(row).find(k => k.includes('fc') || k.includes('hr') || k.includes('frequenz'));
            if (fcKey) fcMax = parseInt(row[fcKey]) || 190;
            
            const vamKey = Object.keys(row).find(k => k.includes('vam') || k.includes('mas') || k.includes('velocit'));
            if (vamKey) vam = parseFloat(row[vamKey]) || 16.0;
          } else {
            name = row[0];
            role = row[1] || 'Centrocampista';
            height = parseInt(row[2]) || 180;
            weight = parseInt(row[3]) || 75;
            birthDate = row[4] || birthDate;
            fcMax = parseInt(row[5]) || 190;
            vam = parseFloat(row[6]) || 16.0;
          }
          
          if (!name) return;
          
          // Preveniamo duplicati per nome
          const exists = this.db.players.some(p => p.name.toLowerCase().trim() === name.toLowerCase().trim());
          if (exists) return;
          
          const id = 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
          
          this.db.players.push({
            id,
            name,
            role,
            status,
            birthDate,
            height,
            weight,
            fcMax,
            vam
          });
          
          this.db.squatProfiles[id] = [];
          this.db.neuromuscularTests[id] = { cmj: [], sj: [] };
          importCount++;
          return;
        }

        let playerName = '';
        if (parsed.hasHeaders) {
          const nameKey = Object.keys(row).find(k => k.includes('nome') || k.includes('Giocatrice') || k.includes('Giocatrice') || k.includes('player'));
          if (nameKey) playerName = row[nameKey];
        } else {
          playerName = row[0];
        }
        
        if (!playerName) return;
        
        const player = this.db.players.find(p => p.name.toLowerCase().trim() === playerName.toLowerCase().trim() || p.name.toLowerCase().includes(playerName.toLowerCase()));
        if (!player) return;
        
        let dateVal = todayStr;
        if (parsed.hasHeaders) {
          const dateKey = Object.keys(row).find(k => k.includes('data') || k.includes('date') || k.includes('timestamp'));
          if (dateKey && row[dateKey]) {
            const match = row[dateKey].match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
            if (match) {
              dateVal = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
            } else {
              const matchEU = row[dateKey].match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
              if (matchEU) {
                dateVal = `${matchEU[3]}-${matchEU[2].padStart(2, '0')}-${matchEU[1].padStart(2, '0')}`;
              }
            }
          }
        }
        
        let log = this.db.dailyLogs.find(l => l.date === dateVal && l.playerId === player.id);
        if (!log) {
          log = {
            id: `log_${player.id}_${dateVal}`,
            date: dateVal,
            playerId: player.id,
            cmjHeight: 0,
            rpe: 0,
            duration: 0,
            sleepQuality: 5,
            sleepDuration: 8.0,
            doms: 1,
            domsNotes: "",
            restingHR: 0,
            sessionHRMax: 0
          };
          this.db.dailyLogs.push(log);
        }
        
        if (type === 'rpe') {
          let rpeVal = 0;
          let durVal = 90; // Default duration
          
          if (parsed.hasHeaders) {
            const rpeKey = Object.keys(row).find(k => k.includes('rpe') || k.includes('sforzo') || k.includes('fatica'));
            if (rpeKey) rpeVal = parseInt(row[rpeKey]) || 0;
            
            const durKey = Object.keys(row).find(k => k.includes('durata') || k.includes('minuti') || k.includes('tempo'));
            if (durKey) durVal = parseInt(row[durKey]) || 90;
          } else {
            rpeVal = parseInt(row[1]) || 0;
            durVal = parseInt(row[2]) || 90;
          }
          
          log.rpe = Math.max(0, Math.min(10, rpeVal));
          log.duration = Math.max(0, durVal);
          importCount++;
        } else if (type === 'recovery') {
          let sleepQ = 5;
          let sleepD = 8.0;
          let domsVal = 1;
          let domsNotes = '';
          
          if (parsed.hasHeaders) {
            const sqKey = Object.keys(row).find(k => k.includes('qualit') || k.includes('sleepquality') || k.includes('sonno'));
            if (sqKey) sleepQ = parseInt(row[sqKey]) || 5;
            
            const sdKey = Object.keys(row).find(k => k.includes('ore') || k.includes('durata sonno') || k.includes('sleepduration') || k.includes('durata'));
            if (sdKey) sleepD = parseFloat(row[sdKey]) || 8.0;
            
            const domsKey = Object.keys(row).find(k => k.includes('doms') || k.includes('dolor') || k.includes('muscol'));
            if (domsKey) domsVal = parseInt(row[domsKey]) || 1;
            
            const notesKey = Object.keys(row).find(k => k.includes('note') || k.includes('dettagli') || k.includes('annotaz'));
            if (notesKey) domsNotes = row[notesKey] || '';
          } else {
            sleepD = parseFloat(row[1]) || 8.0;
            sleepQ = parseInt(row[2]) || 5;
            domsVal = parseInt(row[3]) || 1;
            domsNotes = row[4] || '';
          }
          
          log.sleepQuality = Math.max(1, Math.min(5, sleepQ));
          log.sleepDuration = Math.max(0, sleepD);
          log.doms = Math.max(1, Math.min(5, domsVal));
          log.domsNotes = domsNotes;
          importCount++;
        }
      });
      
      this.saveDatabase();
      this.showToast(`Importati con successo ${importCount} record dal file CSV!`);
      
      if (type === 'roster') {
        this.renderRoster();
        this.renderNeuroLoads();
        this.renderAerobicLoads();
      } else {
        this.renderDailyLog();
        this.renderDashboard();
      }
    };
    reader.readAsText(file);
  }

  startKiosk(mode) {
    this.kioskMode = mode;
    
    // Controlla se l'accesso è da link diretto per nascondere il tasto Esci
    const exitBtn = document.getElementById('kiosk-exit-btn');
    if (exitBtn) {
      const urlParams = new URLSearchParams(window.location.search);
      const isPlayerOnly = urlParams.has('kiosk');
      exitBtn.style.display = isPlayerOnly ? 'none' : 'block';
    }
    
    const title = document.getElementById('kiosk-title');
    const subtitle = document.getElementById('kiosk-subtitle');
    
    if (!title || !subtitle) return;
    
    if (mode === 'post-workout') {
      title.textContent = "Terminale Post-Allenamento";
      subtitle.textContent = "Seleziona il tuo nome per registrare l'RPE della seduta";
    } else {
      title.textContent = "Terminale Stato Mattutino";
      subtitle.textContent = "Seleziona il tuo nome per registrare la qualità del sonno e i DOMS";
    }
    
    const container = document.getElementById('kiosk-players-list');
    if (!container) return;
    container.innerHTML = '';
    
    const activePlayers = [...this.db.players].sort((a,b) => a.name.localeCompare(b.name));

    if (activePlayers.length === 0) {
      container.innerHTML = `
        <div style="grid-column: span 2; text-align: center; color: var(--text-muted); padding: 30px 15px; font-size: 13px; line-height: 1.6; background: rgba(255,255,255,0.02); border: 1px dashed var(--border-color); border-radius: 8px;">
          ⚠️ <strong>Nessuna giocatrice inserita in rosa.</strong><br><br>
          Prima di poter usare il terminale spogliatoio o i link, devi inserire le tue atlete nel menu <strong style="color: var(--primary);">"Rosa Giocatrici"</strong> cliccando sul pulsante <strong>+ Aggiungi Giocatrice</strong>.
        </div>
      `;
      document.getElementById('kiosk-step-player').style.display = 'block';
      document.getElementById('kiosk-step-metrics').style.display = 'none';
      document.getElementById('kiosk-step-success').style.display = 'none';
      const overlay = document.getElementById('kiosk-overlay');
      if (overlay) overlay.style.display = 'flex';
      return;
    }
                                         
    activePlayers.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary';
      btn.style.padding = '15px';
      btn.style.fontSize = '14px';
      btn.style.textAlign = 'center';
      btn.textContent = p.name;
      btn.onclick = () => this.selectKioskPlayer(p.id);
      container.appendChild(btn);
    });
    
    document.getElementById('kiosk-step-player').style.display = 'block';
    document.getElementById('kiosk-step-metrics').style.display = 'none';
    document.getElementById('kiosk-step-success').style.display = 'none';
    
    const overlay = document.getElementById('kiosk-overlay');
    if (overlay) overlay.style.display = 'flex';
  }
  
  selectKioskPlayer(playerId) {
    this.kioskPlayerId = playerId;
    const p = this.db.players.find(x => x.id === playerId);
    if (!p) return;
    
    const nameEl = document.getElementById('kiosk-selected-player-name');
    if (nameEl) nameEl.textContent = p.name;
    
    const container = document.getElementById('kiosk-fields-container');
    if (!container) return;
    container.innerHTML = '';
    
    const todayStr = this.formatLocalDate(new Date());
    const log = this.db.dailyLogs.find(l => l.date === todayStr && l.playerId === playerId);
    
    if (this.kioskMode === 'post-workout') {
      container.innerHTML = `
        <div class="form-group">
          <label style="color: var(--text-white); margin-bottom: 6px; display: block;">Sforzo Percepito dell'allenamento (RPE Borg CR10)</label>
          <select id="kiosk-rpe" class="form-control" style="background-color: var(--bg-primary); border-color: var(--border-color); color: var(--text-white);" required>
            <option value="0" ${!log || log.rpe === 0 ? 'selected' : ''}>0 - Nessuno sforzo</option>
            <option value="1" ${log && log.rpe === 1 ? 'selected' : ''}>1 - Molto Leggero</option>
            <option value="2" ${log && log.rpe === 2 ? 'selected' : ''}>2 - Facile</option>
            <option value="3" ${log && log.rpe === 3 ? 'selected' : ''}>3 - Moderato</option>
            <option value="4" ${log && log.rpe === 4 ? 'selected' : ''}>4 - Abbastanza Duro</option>
            <option value="5" ${log && log.rpe === 5 ? 'selected' : ''}>5 - Duro</option>
            <option value="6" ${log && log.rpe === 6 ? 'selected' : ''}>6 - Duro+</option>
            <option value="7" ${log && log.rpe === 7 ? 'selected' : ''}>7 - Molto Duro</option>
            <option value="8" ${log && log.rpe === 8 ? 'selected' : ''}>8 - Molto Duro+</option>
            <option value="9" ${log && log.rpe === 9 ? 'selected' : ''}>9 - Estenuante</option>
            <option value="10" ${log && log.rpe === 10 ? 'selected' : ''}>10 - Sforzo Massimo</option>
          </select>
        </div>
        <div class="form-group">
          <label style="color: var(--text-white); margin-bottom: 6px; display: block;">Durata Allenamento (minuti)</label>
          <div class="input-unit-wrapper">
            <input type="number" id="kiosk-duration" class="form-control" style="background-color: var(--bg-primary); border-color: var(--border-color); color: var(--text-white);" placeholder="es. 90" value="${log ? log.duration : '90'}" required>
            <span class="input-unit">min</span>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="form-row" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
          <div class="form-group">
            <label style="color: var(--text-white); margin-bottom: 6px; display: block;">Ore di Sonno</label>
            <div class="input-unit-wrapper">
              <input type="number" step="0.5" id="kiosk-sleep-h" class="form-control" style="background-color: var(--bg-primary); border-color: var(--border-color); color: var(--text-white);" placeholder="es. 8" value="${log ? log.sleepDuration : '7.5'}" required>
              <span class="input-unit">ore</span>
            </div>
          </div>
          <div class="form-group">
            <label style="color: var(--text-white); margin-bottom: 6px; display: block;">Qualità del Sonno</label>
            <select id="kiosk-sleep-q" class="form-control" style="background-color: var(--bg-primary); border-color: var(--border-color); color: var(--text-white);" required>
              <option value="5" ${log && log.sleepQuality === 5 ? 'selected' : !log ? 'selected' : ''}>5 - Ottimo</option>
              <option value="4" ${log && log.sleepQuality === 4 ? 'selected' : ''}>4 - Buono</option>
              <option value="3" ${log && log.sleepQuality === 3 ? 'selected' : ''}>3 - Sufficiente</option>
              <option value="2" ${log && log.sleepQuality === 2 ? 'selected' : ''}>2 - Poco</option>
              <option value="1" ${log && log.sleepQuality === 1 ? 'selected' : ''}>1 - Insonnia</option>
            </select>
          </div>
        </div>
        <div class="form-group" style="margin-top: 15px;">
          <label style="color: var(--text-white); margin-bottom: 6px; display: block;">Dolore Muscolare (DOMS)</label>
          <select id="kiosk-doms" class="form-control" style="background-color: var(--bg-primary); border-color: var(--border-color); color: var(--text-white);" required>
            <option value="1" ${log && log.doms === 1 ? 'selected' : !log ? 'selected' : ''}>1 - Nessun Dolore</option>
            <option value="2" ${log && log.doms === 2 ? 'selected' : ''}>2 - Lieve Affaticamento</option>
            <option value="3" ${log && log.doms === 3 ? 'selected' : ''}>3 - Dolore Moderato</option>
            <option value="4" ${log && log.doms === 4 ? 'selected' : ''}>4 - Dolore Forte</option>
            <option value="5" ${log && log.doms === 5 ? 'selected' : ''}>5 - Dolore Invalidante</option>
          </select>
        </div>
        <div class="form-group" style="margin-top: 15px;">
          <label style="color: var(--text-white); margin-bottom: 6px; display: block;">Note Dolori Muscolari (Opzionale)</label>
          <input type="text" id="kiosk-doms-notes" class="form-control" style="background-color: var(--bg-primary); border-color: var(--border-color); color: var(--text-white);" placeholder="es. Fastidio bicipite femorale destro" value="${log ? log.domsNotes || '' : ''}">
        </div>
      `;
    }
    
    document.getElementById('kiosk-step-player').style.display = 'none';
    document.getElementById('kiosk-step-metrics').style.display = 'block';
  }
  
  kioskBack() {
    document.getElementById('kiosk-step-player').style.display = 'block';
    document.getElementById('kiosk-step-metrics').style.display = 'none';
  }
  
  handleKioskSubmit(e) {
    e.preventDefault();
    const playerId = this.kioskPlayerId;
    if (!playerId) return;
    
    const todayStr = this.formatLocalDate(new Date());
    let log = this.db.dailyLogs.find(l => l.date === todayStr && l.playerId === playerId);
    
    if (!log) {
      log = {
        id: `log_${playerId}_${todayStr}`,
        date: todayStr,
        playerId: playerId,
        cmjHeight: 0,
        rpe: 0,
        duration: 0,
        sleepQuality: 5,
        sleepDuration: 8.0,
        doms: 1,
        domsNotes: "",
        restingHR: 0,
        sessionHRMax: 0
      };
      this.db.dailyLogs.push(log);
    }
    
    if (this.kioskMode === 'post-workout') {
      log.rpe = parseInt(document.getElementById('kiosk-rpe').value);
      log.duration = parseInt(document.getElementById('kiosk-duration').value) || 90;
    } else {
      log.sleepDuration = parseFloat(document.getElementById('kiosk-sleep-h').value) || 8.0;
      log.sleepQuality = parseInt(document.getElementById('kiosk-sleep-q').value);
      log.doms = parseInt(document.getElementById('kiosk-doms').value);
      log.domsNotes = document.getElementById('kiosk-doms-notes').value.trim();
    }
    
    this.saveDatabase();
    
    const playerObj = this.db.players.find(p => p.id === playerId);
    const pName = playerObj ? playerObj.name : 'Giocatrice';
    let waMsg = '';
    if (this.kioskMode === 'post-workout') {
      waMsg = `U.S. MOZZO PALLAVOLO: ${pName} ha registrato RPE ${log.rpe} (${log.duration} min) per l'allenamento!`;
    } else {
      waMsg = `U.S. MOZZO PALLAVOLO: ${pName} ha registrato Sonno ${log.sleepDuration}h (Qualità ${log.sleepQuality}/5) e DOMS ${log.doms}/5!`;
    }
    
    const waBtn = document.getElementById('kiosk-wa-btn');
    if (waBtn) {
      waBtn.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(waMsg)}`;
    }

    document.getElementById('kiosk-step-metrics').style.display = 'none';
    document.getElementById('kiosk-step-success').style.display = 'block';
    
    lucide.createIcons({ root: document.getElementById('kiosk-step-success') });
    
    setTimeout(() => {
      this.startKiosk(this.kioskMode);
    }, 6000);
  }
  
  exitKiosk() {
    document.getElementById('kiosk-overlay').style.display = 'none';
    this.kioskMode = null;
    this.kioskPlayerId = null;
    this.renderDailyLog();
    this.renderDashboard();
  }

  formatLocalDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  generateDefaultEvents() {
    const today = new Date();
    const yest = new Date(today); yest.setDate(today.getDate() - 1);
    const yestStr = this.formatLocalDate(yest);
    const todStr = this.formatLocalDate(today);
    const tom = new Date(today); tom.setDate(today.getDate() + 1);
    const tomStr = this.formatLocalDate(tom);
    const sunday = new Date(today);
    while (sunday.getDay() !== 0) {
      sunday.setDate(sunday.getDate() + 1);
    }
    const sunStr = this.formatLocalDate(sunday);

    return [
      {
        id: "evt_1",
        date: yestStr,
        time: "10:30",
        type: "Allenamento",
        title: "Seduta di Recupero e Rigenerazione",
        objectives: "Favorire lo smaltimento dell'acido lattico e il recupero del tono muscolare post-gara.",
        proposedWorkouts: "- 15 min corsa leggera rigenerativa\n- 20 min mobilità articolare e stretching dinamico\n- 3 serie di calcio-tennis ricreativo\n- Trattamenti di crioterapia e fisioterapia"
      },
      {
        id: "evt_2",
        date: todStr,
        time: "15:00",
        type: "Allenamento",
        title: "Seduta Tecnico-Tattica Principale",
        objectives: "Migliorare la transizione offensiva veloce, la fluidità del giropalla a 3 tocchi e il pressing alto.",
        proposedWorkouts: "- Riscaldamento: 15m coordinativo con palla\n- Esercitazione: Rondos 6v2 con cambio di campo rapido (20m)\n- Tattica: Sviluppo del gioco 11v0 focalizzato sulle catene laterali (25m)\n- Partita a tema: 10v10 a tocchi limitati (massimo 3 tocchi) (25m)\n- Defaticamento e core stability (10m)"
      },
      {
        id: "evt_3",
        date: tomStr,
        time: "10:00",
        type: "Allenamento",
        title: "Lavoro Neuromuscolare e Velocità",
        objectives: "Focalizzazione sul potenziale neuromuscolare degli Giocatrici con salti CMJ e sprint brevi di accelerazione.",
        proposedWorkouts: "- Riscaldamento Giocatricico e andature veloci (15m)\n- Lavoro a stazioni: CMJ frenato + Sprint 10m con traino leggero (20m)\n- Esercitazione VBT: Squat dinamici monitorati a velocità target 0.7 m/s (25m)\n- Partita finale ad alta intensità a ranghi ridotti 4v4 (20m)"
      },
      {
        id: "evt_4",
        date: sunStr,
        time: "15:30",
        type: "Partita di Campionato",
        title: "U.C. AlbinoLeffe vs Renate",
        objectives: "Vittoria e consolidamento della fase difensiva. Marcatura a uomo sulle palle inattive avversarie.",
        proposedWorkouts: "- Ore 14:00: Riunione tecnica pre-gara nello spogliatoio\n- Ore 14:45: Inizio riscaldamento sul campo\n- Ore 15:30: Calcio d'inizio della partita\n- Ore 17:30: Defaticamento in acqua fredda e nutrizione post-gara"
      }
    ];
  }

  renderSchedule() {
    if (!this.currentCalendarDate) {
      this.currentCalendarDate = new Date();
    }
    
    const year = this.currentCalendarDate.getFullYear();
    const month = this.currentCalendarDate.getMonth();
    
    const monthNames = [
      "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
      "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
    ];
    document.getElementById('calendar-month-year').textContent = `${monthNames[month]} ${year}`;
    
    const grid = document.getElementById('calendar-days-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const firstDay = new Date(year, month, 1);
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    
    // Previous month padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const dateStr = this.formatLocalDate(prevDate);
      const cell = this.createCalendarDayCell(dayNum, dateStr, true);
      grid.appendChild(cell);
    }
    
    // Current month days
    const todayStr = this.formatLocalDate(new Date());
    for (let d = 1; d <= daysInMonth; d++) {
      const currentDate = new Date(year, month, d);
      const dateStr = this.formatLocalDate(currentDate);
      const isToday = dateStr === todayStr;
      const cell = this.createCalendarDayCell(d, dateStr, false, isToday);
      grid.appendChild(cell);
    }
    
    // Next month padding
    const totalCells = grid.children.length;
    const remaining = 42 - totalCells;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      const dateStr = this.formatLocalDate(nextDate);
      const cell = this.createCalendarDayCell(i, dateStr, true);
      grid.appendChild(cell);
    }
    
    this.renderScheduleList();
    
    try {
      lucide.createIcons({ root: grid });
    } catch(e){}
  }

  createCalendarDayCell(dayNum, dateStr, isOutOfMonth, isToday = false) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day-cell';
    if (isOutOfMonth) cell.classList.add('out-of-month');
    if (isToday) cell.classList.add('is-today');
    if (this.selectedScheduleDateStr === dateStr) {
      cell.classList.add('active-selected');
    }
    
    cell.innerHTML = `<span class="day-number">${dayNum}</span>`;
    
    if (this.db.calendarEvents) {
      const events = this.db.calendarEvents.filter(e => e.date === dateStr);
      if (events.length > 0) {
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'day-events-container';
        
        events.forEach(evt => {
          const badge = document.createElement('div');
          const typeClass = `event-${evt.type.toLowerCase().replace(/\s+/g, '-')}`;
          badge.className = `calendar-event-badge ${typeClass}`;
          
          let iconMarkup = '•';
          if (evt.type === 'Allenamento') iconMarkup = '🏃';
          else if (evt.type.startsWith('Partita')) iconMarkup = '⚽';
          else if (evt.type === 'Riposo') iconMarkup = '💤';
          
          badge.innerHTML = `${iconMarkup} ${evt.title}`;
          eventsContainer.appendChild(badge);
        });
        
        cell.appendChild(eventsContainer);
      }
    }
    
    if (!isOutOfMonth) {
      cell.onclick = () => this.selectCalendarDate(dateStr);
    }
    
    return cell;
  }

  prevMonth() {
    if (!this.currentCalendarDate) this.currentCalendarDate = new Date();
    this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() - 1);
    this.renderSchedule();
  }

  nextMonth() {
    if (!this.currentCalendarDate) this.currentCalendarDate = new Date();
    this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + 1);
    this.renderSchedule();
  }

  selectCalendarDate(dateStr) {
    this.selectedScheduleDateStr = dateStr;
    this.renderSchedule();
    
    document.getElementById('event-date').value = dateStr;
    const form = document.getElementById('event-form');
    form.reset();
    document.getElementById('event-date').value = dateStr;
    
    const existing = this.db.calendarEvents.find(e => e.date === dateStr);
    const deleteBtn = document.getElementById('btn-delete-event');
    const titleEl = document.getElementById('event-editor-title');
    
    if (existing) {
      titleEl.textContent = 'Modifica Impegno';
      document.getElementById('event-id').value = existing.id;
      document.getElementById('event-type').value = existing.type;
      document.getElementById('event-time').value = existing.time;
      document.getElementById('event-title').value = existing.title;
      document.getElementById('event-objectives').value = existing.objectives || '';
      document.getElementById('event-workouts').value = existing.proposedWorkouts || '';
      if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    } else {
      titleEl.textContent = 'Nuovo Impegno';
      document.getElementById('event-id').value = '';
      document.getElementById('event-type').value = 'Allenamento';
      document.getElementById('event-time').value = '10:00';
      document.getElementById('event-title').value = '';
      document.getElementById('event-objectives').value = '';
      document.getElementById('event-workouts').value = '';
      if (deleteBtn) deleteBtn.style.display = 'none';
    }
    
    // Open the modal
    document.getElementById('event-modal').classList.add('open');
    
    try {
      lucide.createIcons({ root: document.getElementById('event-modal') });
    } catch(e){}
  }

  closeEventModal() {
    document.getElementById('event-modal').classList.remove('open');
    this.selectedScheduleDateStr = null;
    this.renderSchedule();
  }

  handleEventSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('event-id').value;
    const date = document.getElementById('event-date').value;
    const type = document.getElementById('event-type').value;
    const time = document.getElementById('event-time').value;
    const title = document.getElementById('event-title').value.trim();
    const objectives = document.getElementById('event-objectives').value.trim();
    const proposedWorkouts = document.getElementById('event-workouts').value.trim();
    
    if (!this.db.calendarEvents) this.db.calendarEvents = [];
    
    if (id) {
      const index = this.db.calendarEvents.findIndex(evt => evt.id === id);
      if (index !== -1) {
        this.db.calendarEvents[index] = { id, date, type, time, title, objectives, proposedWorkouts };
      }
    } else {
      const alreadyHasEvent = this.db.calendarEvents.some(evt => evt.date === date);
      if (alreadyHasEvent) {
        if (!confirm("Esiste già un impegno per questa data. Vuoi sovrascriverlo?")) {
          return;
        }
        this.db.calendarEvents = this.db.calendarEvents.filter(evt => evt.date !== date);
      }
      
      const newId = `evt_${Date.now()}`;
      this.db.calendarEvents.push({ id: newId, date, type, time, title, objectives, proposedWorkouts });
    }
    
    this.saveDatabase();
    this.showToast("Impegno salvato con successo!");
    this.closeEventModal();
    this.renderDashboard();
  }

  handleEventDelete() {
    const id = document.getElementById('event-id').value;
    if (!id) return;
    
    if (confirm("Sei sicuro di voler eliminare questo impegno?")) {
      this.db.calendarEvents = this.db.calendarEvents.filter(evt => evt.id !== id);
      this.saveDatabase();
      this.showToast("Impegno eliminato.");
      
      this.closeEventModal();
      this.renderDashboard();
    }
  }

  renderScheduleList() {
    const tbody = document.getElementById('schedule-list-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!this.db.calendarEvents || this.db.calendarEvents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Nessun impegno in calendario.</td></tr>`;
      return;
    }
    
    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingEvents = this.db.calendarEvents
      .filter(e => e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));
      
    if (upcomingEvents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Nessun impegno futuro programmato.</td></tr>`;
      return;
    }
    
    upcomingEvents.forEach(evt => {
      const tr = document.createElement('tr');
      const typeClass = `event-${evt.type.toLowerCase().replace(/\s+/g, '-')}`;
      const dateFormatted = new Date(evt.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      
      tr.innerHTML = `
        <td><strong>${dateFormatted}</strong></td>
        <td>${evt.time}</td>
        <td><span class="badge ${typeClass}">${evt.type}</span></td>
        <td><strong>${evt.title}</strong></td>
        <td class="text-muted" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${evt.objectives || '-'}</td>
        <td style="text-align: center;">
          <button class="btn btn-secondary btn-sm" onclick="app.showTab('schedule-panel'); app.selectCalendarDate('${evt.date}')">
            <i data-lucide="edit-2"></i> Gestisci
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    try {
      lucide.createIcons({ root: tbody });
    } catch(e){}
  }

  renderStaffNotebook() {
    const selectedDate = document.getElementById('global-date').value;
    const evt = this.db.calendarEvents ? this.db.calendarEvents.find(e => e.date === selectedDate) : null;
    
    const titleEl = document.getElementById('notebook-title');
    const timeEl = document.getElementById('notebook-time');
    const badgeEl = document.getElementById('notebook-type-badge');
    const objEl = document.getElementById('notebook-objectives');
    const workEl = document.getElementById('notebook-workouts');
    
    if (evt) {
      if (titleEl) titleEl.textContent = evt.title;
      if (timeEl) timeEl.innerHTML = `<i data-lucide="clock" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle;"></i> ${evt.time}`;
      
      if (badgeEl) {
        badgeEl.textContent = evt.type;
        const typeClass = `event-${evt.type.toLowerCase().replace(/\s+/g, '-')}`;
        badgeEl.className = `badge ${typeClass}`;
      }
      
      if (objEl) objEl.textContent = evt.objectives || 'Nessun obiettivo inserito per questa sessione.';
      if (workEl) workEl.textContent = evt.proposedWorkouts || 'Nessun programma lavori inserito.';
    } else {
      if (titleEl) titleEl.textContent = 'Nessuna attività programmata';
      if (timeEl) timeEl.innerHTML = `<i data-lucide="clock" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle;"></i> --:--`;
      if (badgeEl) {
        badgeEl.textContent = 'Libero / Riposo';
        badgeEl.className = 'badge event-riposo';
      }
      if (objEl) objEl.textContent = 'Nessun impegno salvato per questa data dello staff. Clicca sul menù "Programmazione" a sinistra per inserire un allenamento o una partita.';
      if (workEl) workEl.textContent = '-';
    }
    
    const notebookCard = document.querySelector('.notebook-container-card');
    if (notebookCard) {
      try {
        lucide.createIcons({ root: notebookCard });
      } catch(e){}
    }
  }

  saveCloudUrl() {
    const input = document.getElementById('config-cloud-url');
    if (!input) return;
    
    const val = input.value.trim();
    this.cloudUrl = val;
    localStorage.setItem('soccer_cloud_url', val);
    this.showToast("URL Cloud salvato.");
    const urlInput = document.getElementById('config-cloud-url');
    if (!urlInput) return;
    
    this.cloudUrl = urlInput.value.trim();
    localStorage.setItem('soccer_cloud_url', this.cloudUrl);
    
    if (this.cloudUrl) {
      this.pullFromCloud();
      this.startCloudAutoPull();
    } else {
      if (this.cloudPullInterval) clearInterval(this.cloudPullInterval);
    }
  }

  pullFromCloud(silent = false) {
    if (!this.cloudUrl) {
      if (!silent) this.showToast("Nessun URL cloud configurato.", "error");
      return;
    }

    const statusEl = document.getElementById('cloud-sync-status');
    if (statusEl && !silent) {
      statusEl.textContent = 'Stato: Ricezione in corso...';
      statusEl.className = 'small-text text-muted';
    }
    
    const kioskStatus = document.getElementById('kiosk-cloud-status');
    if (kioskStatus && !silent) {
      kioskStatus.innerHTML = '<span style="color: var(--text-muted);">🔄 Connessione al database...</span>';
    }

    fetch(this.cloudUrl)
      .then(res => {
        if (!res.ok) throw new Error("Risposta di rete non valida.");
        return res.json();
      })
      .then(data => {
        if (data && Array.isArray(data.players) && Array.isArray(data.dailyLogs)) {
          const oldLogsCount = (this.db && this.db.dailyLogs) ? this.db.dailyLogs.length : 0;
          this.db = data;
          this.saveDatabase(true); // Salva localmente saltando il push
          
          const newLogsCount = this.db.dailyLogs.length;
          if (!silent || newLogsCount > oldLogsCount) {
            this.showToast("⚡ Nuovi dati sincronizzati dal Cloud!");
          }
          
          this.renderActiveTab();
          
          if (this.kioskMode) {
            this.startKiosk(this.kioskMode);
          }
          
          if (kioskStatus && !silent) {
            kioskStatus.innerHTML = '<span style="color: #10b981;">🟢 Sincronizzato con il Cloud</span>';
          }
          
          if (statusEl) {
            const timeStr = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            statusEl.innerHTML = `<span style="color: #10b981; font-weight: 700;">🟢 Sincronizzato alle ${timeStr}</span>`;
          }
        } else {
          if (!silent) console.warn("Dati cloud vuoti o non validi, inizializzo il cloud.");
          this.syncToCloud();
        }
      })
      .catch(err => {
        console.error("Errore sinc cloud (pull):", err);
        if (statusEl && !silent) {
          statusEl.innerHTML = `<span style="color: #ef4444; font-weight: 700;">🔴 Errore sincronizzazione</span>`;
        }
        if (kioskStatus && !silent) {
          kioskStatus.innerHTML = '<span style="color: #ef4444;">🔴 Modalità Offline</span>';
        }
        if (!silent) this.showToast("Impossibile scaricare i dati dal cloud.", "error");
      });
  }

  syncToCloud() {
    if (!this.cloudUrl) return;

    const statusEl = document.getElementById('cloud-sync-status');
    if (statusEl) {
      statusEl.textContent = 'Stato: Invio dati in corso...';
    }

    // Usiamo POST con mode 'no-cors' per inviare i dati aggirando i limiti di CORS di Apps Script
    fetch(this.cloudUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(this.db)
    })
    .then(() => {
      console.log("Database sincronizzato in cloud via Apps Script.");
      if (statusEl) {
        const timeStr = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        statusEl.innerHTML = `<span style="color: #10b981; font-weight: 700;">🟢 Sincronizzato alle ${timeStr}</span>`;
      }
    })
    .catch(err => {
      console.error("Errore sinc cloud (push):", err);
      if (statusEl) {
        statusEl.innerHTML = `<span style="color: #ef4444; font-weight: 700;">🔴 Errore invio dati</span>`;
      }
    });
  }
}

// Global App Instance
let app;
window.addEventListener('DOMContentLoaded', () => {
  app = new AthleteHubApp();
  app.init();
  
  // Make app accessible globally for onclick triggers in tables
  window.app = app;
});

