// Shared by the sidebar and isolated webpage companion.
export const uiTokens = {
  green: '#315c43', surface: '#f7f5ef', ink: '#243128', muted: '#626c61',
  font: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

// Both the side panel and page Shadow DOM use the same opaque surfaces.
export const uiTheme = `
  --green:${uiTokens.green}; --surface:${uiTokens.surface}; --ink:${uiTokens.ink}; --muted:${uiTokens.muted};
  --raised:#fffefa; --soft:#e9eddf; --line:#dedcd2; --button-ink:#fffefa;
  --green-hover:#254c36; --error:#9b493a; --error-surface:#f4e6dd;
  --shadow:0 10px 32px rgb(27 40 29 / 16%); color-scheme:light;
`;
export const uiDarkTheme = `
  --green:#b5d1ad; --surface:#191f1c; --ink:#f0f0e7; --muted:#adb8aa;
  --raised:#252d28; --soft:#303c32; --line:#414b43; --button-ink:#1d2921;
  --green-hover:#c7dfbf; --error:#e7a18d; --error-surface:#3c2b25;
  --shadow:0 10px 32px rgb(0 0 0 / 28%); color-scheme:dark;
`;
