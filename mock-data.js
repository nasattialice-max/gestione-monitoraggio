// File Sincronizzato Rosa U.S. MOZZO PALLAVOLO
const generateMockData = () => {
  return {
  "players": [
    {
      "id": "p_1785083532038",
      "name": "Alice Nasatti",
      "role": "Palleggiatrice (Alzatrice)",
      "status": "Disponibile",
      "birthDate": "2001-12-12",
      "height": 160,
      "weight": 63,
      "injuryNotes": ""
    },
    {
      "id": "p_1785084172913",
      "name": "Davida F",
      "role": "Palleggiatrice (Alzatrice)",
      "status": "Disponibile",
      "birthDate": "2001-07-26",
      "height": 175,
      "weight": 48,
      "injuryNotes": ""
    },
    {
      "id": "p_1785101493941",
      "name": "miriam",
      "role": "Palleggiatrice (Alzatrice)",
      "status": "Disponibile",
      "birthDate": "2001-07-05",
      "height": 180,
      "weight": 70,
      "injuryNotes": ""
    }
  ],
  "dailyLogs": [
    {
      "id": "log_p_1785083532038_2026-07-26",
      "date": "2026-07-26",
      "playerId": "p_1785083532038",
      "cmjHeight": 0,
      "rpe": 3,
      "duration": 90,
      "sleepQuality": 5,
      "sleepDuration": 8,
      "doms": 1,
      "domsNotes": "",
      "restingHR": 0,
      "sessionHRMax": 0
    },
    {
      "id": "log_p_1785084172913_2026-07-26",
      "date": "2026-07-26",
      "playerId": "p_1785084172913",
      "cmjHeight": 0,
      "rpe": 2,
      "duration": 90,
      "sleepQuality": 5,
      "sleepDuration": 8,
      "doms": 1,
      "domsNotes": "",
      "restingHR": 0,
      "sessionHRMax": 0
    },
    {
      "id": "log_p_1785101493941_2026-07-27",
      "date": "2026-07-27",
      "playerId": "p_1785101493941",
      "cmjHeight": 0,
      "rpe": 1,
      "duration": 40,
      "sleepQuality": 5,
      "sleepDuration": 8,
      "doms": 1,
      "domsNotes": "",
      "restingHR": 0,
      "sessionHRMax": 0
    },
    {
      "id": "log_p_1785083532038_2026-07-27",
      "date": "2026-07-27",
      "playerId": "p_1785083532038",
      "cmjHeight": 0,
      "rpe": 0,
      "duration": 0,
      "sleepQuality": 5,
      "sleepDuration": 7.5,
      "doms": 1,
      "domsNotes": "",
      "restingHR": 0,
      "sessionHRMax": 0
    },
    {
      "id": "log_p_1785084172913_2026-07-27",
      "date": "2026-07-27",
      "playerId": "p_1785084172913",
      "cmjHeight": 0,
      "rpe": 8,
      "duration": 90,
      "sleepQuality": 4,
      "sleepDuration": 7.5,
      "doms": 3,
      "domsNotes": "",
      "restingHR": 0,
      "sessionHRMax": 0
    },
    {
      "id": "log_p_mozzo_3_2026-07-26",
      "date": "2026-07-26",
      "playerId": "p_mozzo_3",
      "cmjHeight": 0,
      "rpe": 6,
      "duration": 90,
      "sleepQuality": 5,
      "sleepDuration": 8,
      "doms": 1,
      "domsNotes": "",
      "restingHR": 0,
      "sessionHRMax": 0
    },
    {
      "id": "log_p_1785101493941_2026-07-26",
      "date": "2026-07-26",
      "playerId": "p_1785101493941",
      "cmjHeight": 0,
      "rpe": 7,
      "duration": 112,
      "sleepQuality": 3,
      "sleepDuration": 8,
      "doms": 4,
      "domsNotes": "",
      "restingHR": 0,
      "sessionHRMax": 0
    }
  ],
  "physicalTests": [],
  "squatProfiles": {
    "p_1785083532038": [],
    "p_1785084172913": [],
    "p_1785101493941": []
  },
  "neuromuscularTests": {
    "p_1785083532038": {
      "cmj": [],
      "sj": []
    },
    "p_1785084172913": {
      "cmj": [],
      "sj": []
    },
    "p_1785101493941": {
      "cmj": [],
      "sj": []
    }
  },
  "calendarEvents": [],
  "settings": {
    "teamName": "U.S. MOZZO",
    "hubName": "sez. PALLAVOLO",
    "logoUrl": "us_mozzo_logo.png"
  }
};
};

window.MOCK_DATA = generateMockData();
