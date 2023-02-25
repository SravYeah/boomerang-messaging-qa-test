const {defineConfig} = require("cypress");

module.exports = defineConfig({
    env: {
        wikiUrl: "https://en.wikipedia.org",
        bbcUrl: "https://www.bbc.co.uk"
    },
    e2e: {
        defaultCommandTimeout: 30000,
        requestTimeout: 30000,
        experimentalOriginDependencies: true,
        experimentalSessionAndOrigin: true,
        viewportWidth: 1024,
        viewportHeight: 1024,
        setupNodeEvents(on, config) {
            on("before:browser:launch", (browser = {}, launchOptions) => {
                if (browser.name === "chrome") {
                    launchOptions.args.push("--disable-dev-shm-usage");
                    return launchOptions;
                }
            });
        },
    },
});
