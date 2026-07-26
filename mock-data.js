// Clean initial state for Soccer Team Manager
// Exposes window.MOCK_DATA to the frontend application (Empty Roster & Data)

const generateMockData = () => {
  return {
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
};

window.MOCK_DATA = generateMockData();
