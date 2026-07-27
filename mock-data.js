// File Sincronizzato Rosa U.S. MOZZO PALLAVOLO
const generateMockData = () => {
  return {
    players: [
      {
        id: "p1",
        number: 1,
        name: "Alice Nasatti",
        role: "Schiacciatrice",
        height: 175,
        weight: 65,
        fcMax: 190,
        status: "Attivo",
        notes: ""
      },
      {
        id: "p2",
        number: 2,
        name: "Miriam P",
        role: "Palleggiatrice",
        height: 172,
        weight: 62,
        fcMax: 188,
        status: "Attivo",
        notes: ""
      },
      {
        id: "p3",
        number: 3,
        name: "Luigia L",
        role: "Centrale",
        height: 180,
        weight: 68,
        fcMax: 185,
        status: "Attivo",
        notes: ""
      }
    ],
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
};

window.MOCK_DATA = generateMockData();
