/// <reference types="cypress" />
/// <reference types="cypress-mailslurp" />

describe("QA Test", () => {

    context("Get random city and check the weather, send an email", () => {

        // These are the inbox IDs from MailSlurp for send and receive emails testing purposes, they are not real emails
        // These inbox id's are created in the MailSlurp dashboard, these values should be pass it as environment variables in actual framework.
        let fromEmailAddress = "0da8314f-be5d-4fc5-9cbd-4ffb983e33b0@mailslurp.com";
        let toEmailDetails = {
            inboxId: "1ecc40d4-f5db-4ad9-afcb-fc5662fbe3d9",
            address: "1ecc40d4-f5db-4ad9-afcb-fc5662fbe3d9@mailslurp.com"
        }

        beforeEach(() => {
            cy.visit(Cypress.env("wikiUrl") + "/wiki/List_of_cities_in_the_United_Kingdom#List_of_cities");
        });

        it("should be able send weather information for random City in the email", () => {
            cy.title().should("eq", "List of cities in the United Kingdom - Wikipedia")
                .log("User is on the wikipedia page");

            cy.get("#List_of_cities").should("be.visible").log("User is on the List of cities section");

            // Get the list of cities from the table
            let citiesList = [];
            cy.get(".mw-parser-output > table:first > tbody > tr", {log: false}).then((rows) => {

                expect(rows.length).to.be.greaterThan(0);

                for (let i = 1; i < rows.length; i++) {
                    cy.get(".mw-parser-output > table:first > tbody > tr", {log: false}).eq(i, {log: false}).then((row) => {
                        cy.get(".mw-parser-output > table:first > tbody > tr", {log: false}).eq(i, {log: false}).find("td", {log: false}).eq(0, {log: false}).then((cityDetails) => {

                            let cityName;

                            // get href attribute of the city
                            let cityTitle = cityDetails.find("a").eq(0).attr("title");
                            cityTitle = cityTitle.replace("City of ", "");
                            let cityValue = cityDetails.find("a").eq(0).text();

                            // check if city value & city title are same
                            if (cityValue.includes(cityTitle)) {
                                cityName = cityTitle;
                            } else {
                                cityName = cityValue;
                            }

                            citiesList.push(cityName);
                            cy.wrap(citiesList, {log: false}).as("listOfCities")
                        });
                    });
                }


                let randomCity = null;
                // save one city name into variable
                cy.get("@listOfCities").then((cityList) => {
                    expect(cityList.length).to.be.greaterThan(0);
                    // pick a random city from the list
                    cy.window().then((win) => {
                        randomCity = cityList[Math.floor(Math.random() * cityList.length)];
                        // remove number from the city name
                        randomCity = randomCity.replace(/[0-9]/g, '');
                        // split the city name by comma
                        randomCity = randomCity.split(",")[0];
                        cy.log("Random city picked up for weather check: " + randomCity);
                        cy.wrap(randomCity, {log: false}).as("randomCityPicker");
                    })
                });

                // Check the weather for the random city against BBC Weather page using cy.origin
                cy.get("@randomCityPicker").then((cityName) => {

                    cy.origin(Cypress.env("bbcUrl"), {args: {cityName}}, ({cityName}) => {

                        const bbcWeatherHomePageTitle = "BBC Weather - Home";
                        let listOfTemperatures = [];

                        cy.log("City name from the origin: " + cityName);
                        cy.visit("/weather").log("User navigated to the BBC Weather page");
                        cy.title().should("eq", bbcWeatherHomePageTitle)
                            .log("User is on the BBC Weather page");

                        cy.get("#ls-c-search__input-label")
                            .should("be.visible")
                            .type(cityName, {delay: 100})
                            .log("User looking for the city: " + cityName);

                        cy.get("#location-list")
                            .should("be.visible")
                            .find("li").first().click({force: true})
                            .log("User clicked on the city: " + cityName);

                        cy.get("#wr-location-name-id").should("be.visible").then((city) => {
                            cy.log("City name: " + city.text());
                            // assert the city name partially matches with the city name from the origin
                            expect(city.text().toLowerCase()).to.include(cityName.toLowerCase());
                        });

                        cy.get("#daylink-0").should("be.visible").log("User is on the weather page for the current day");
                        //Click next week day button
                        for (let i = 0; i < 2; i++) {
                            cy.get("[data-action*='next']").eq(0).should("be.visible").click({force: true})
                                .log("User clicked next week day button to get the weather information for the next week day");
                        }
                        cy.get("div[aria-label*='Saturday']").eq(1).should("be.visible").click({force: true})
                            .log("User clicked on weekend Saturday to get the weather information for the weekend");

                        cy.get("div[aria-label*='Saturday']").eq(1).parent().then((saturday) => {
                            expect(saturday.text()).to.include("Saturday");
                            cy.log("User is on the weather page for the weekend Saturday");
                        });

                        cy.get(".wr-time-slot-primary__temperature").each((temp) => {
                            for (let i = 0; i < temp.length; i++) {
                                cy.wrap(temp, {log: false}).eq(i, {log: false}).find("span", {log: false}).find("span", {log: false}).eq(0, {log: false}).then((tempValue) => {
                                    let temperature = parseInt(tempValue.text());
                                    // cy.log("Temperature: " + tempValue.text());
                                    listOfTemperatures.push(temperature);
                                });
                            }
                            cy.wrap(listOfTemperatures, {log: false}).as("listOfTemperatures");
                        });

                        // get the weather description for all hours
                        cy.get("@listOfTemperatures").then((listOfTemperatures) => {
                            cy.log("size of the list: " + listOfTemperatures.length);
                            // save this list into a file fixture
                            cy.writeFile("cypress/fixtures/temperatures.json", listOfTemperatures, {log: false});
                        });
                    });
                });

                // get the temperature from the file fixture
                cy.readFile("cypress/fixtures/temperatures.json", {log: false}).then((listOfTemperatures) => {
                    cy.get("@randomCityPicker").then((cityName) => {
                        // delete all the emails from the inbox for testing purpose otherwise it will takes lot of space & time
                        cy.mailslurp()
                            .then(mailslurp => mailslurp.emptyInbox(toEmailDetails.inboxId))
                            .then(() => cy.log("All emails deleted from the inbox"));

                        // if temperature is greater than 10 or more, then send the email
                        if (listOfTemperatures.some((temp) => temp >= 10)) {
                            cy.log("Temperature is greater than 10 or more, its a good day to go out " + cityName);
                            cy.mailslurp()
                                .then(mailslurp => mailslurp.sendEmail(toEmailDetails.inboxId, {
                                    to: [toEmailDetails.address],
                                    from: fromEmailAddress,
                                    subject: "Weather report for " + cityName,
                                    body: "<html><h3>Hey there, here is the weather report for " + cityName + "<h3></h3><p>In " + cityName + " the weather going to be Nice and sunny so lets get out for picnic.</p></html>",
                                    isHTML: false
                                }))
                        } else {
                            cy.log("Temperature is less than 10, its a bad day to go out at " + cityName);
                            cy.mailslurp()
                                .then(mailslurp => mailslurp.sendEmail(toEmailDetails.inboxId, {
                                    to: [toEmailDetails.address],
                                    from: fromEmailAddress,
                                    subject: "Weather report for " + cityName,
                                    body: "<html><h3>Hey there, here is the weather report for " + cityName + "<h3></h3><p>In " + cityName + " the weather going to be under 10c so stay home, sad :(</p></html>",
                                    isHTML: false
                                }))
                        }
                        // validate received email contains the city name
                        cy.mailslurp()
                            .then(mailslurp => mailslurp.waitForLatestEmail(toEmailDetails.inboxId, 30000))
                            .then(email => {
                                expect(email.body).to.include(cityName);
                                expect(email.subject).to.include(cityName);
                                cy.log("Email received with the city name: " + cityName)
                            });
                    });
                });
            });
        });
    });
});


