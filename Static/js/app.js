/* ONE CALL API: DAILY FORECAST
   FORECAST API: HOURLY FORECAST
*/

//  CLASS TO HANDLE AND TO MAKE WEB API REQUEST TO OPENWEATHER
class WeatherAPI {
  constructor(id, lang = "en", unit = "metric", apiImageFormat = "@2x.png") {
    this.id = id;
    this.lang = lang;
    this.unit = unit;
    this.apiImageFormat = apiImageFormat;
    this.cache = new Map();
  }
  setId(value) {
    this.id = value;
    return this;
  }
  setLang(value) {
    this.lang = value;
    return this;
  }
  setUnit(value) {
    this.unit = value;
    return this;
  }

  //  TYPE SPECIFIES IF THE TYPE OF REQUEST: FOR "ONE API CALL" PASS "ONE", FOR "FORECAST CALL" PASS "FORECAST"
  async make(request, method = "GET", type = "one") {
    // Sum up the vatiables for the request
    let req = {
      ...request,
      lang: this.lang,
      APPID: this.id,
      units: this.unit,
    };
    // This is the key associtated to the response, stored in the cache map
    let key = {
      ...req,
      type: type,
    };
    // Checking if a request equal to the current one was made before. In positive case we withdraw the value from the cache instead of making another request
    if (this.cache.has(JSON.stringify(key)))
      return Promise.resolve(this.cache.get(JSON.stringify(key)));

    // We create the url root basing on "type"
    let url = type === "one" ? new URL(WeatherAPI.apiUrlOneCall) : new URL(WeatherAPI.apiUrl);

    // We make the actual request with "fetch", choosing between "get" and "post"
    let prom = null;
    switch (method.toLowerCase().trim()) {
      case "get":
        // We create the complete url basing on "req"
        url.search = new URLSearchParams(req).toString();
        prom = fetch(url);
        break;
      case "post":
        prom = fetch(url, {
          method: "POST",
          body: req,
        });
        break;
      default:
        throw new Error("Method not supported, choose between GET and POST")
    }
    return prom.then((resp) => {
      // Checking if the name entered is correct, else returning the response
      if (!resp.ok) throw new Error("Il nome inserito non è stato trovato");
      else {
        let obj = resp.json();
        this.cache.set(JSON.stringify(key), obj);
        return obj;
      }
    });
  }

  // Getting the information basing on the name of the city
  byCity(city, type) {
    return this.make(
      {
        q: city,
      },
      "get",
      type
    );
  }
  // Getting the information basing on the coords of the city
  byLatLong({ lat, long }, type) {
    return this.make(
      {
        lat: lat,
        lon: long,
      },
      "get",
      type
    );
  }

  // Getting the icon url basing on the icon id
  icon(icon) {
    return WeatherAPI.apiImageUrl + icon + this.apiImageFormat;
  }
  // Getting the root url of the two "forecasts"
  static get apiUrl() {
    return "https://api.openweathermap.org/data/2.5/forecast";
  }
  static get apiUrlOneCall() {
    return "https://api.openweathermap.org/data/2.5/onecall?exclude=minutely,hourly,current&";
  }

  static get apiImageUrl() {
    return "http://openweathermap.org/img/wn/";
  }
  static get id() {
    return this.id;
  }
  static get lang() {
    return this.lang;
  }
  static get unit() {
    return this.unit;
  }
}

const dom = {};
const wapi = new WeatherAPI("5fa9a800de7bb9bcd2867f52a5d3d754");
$(() => {
  // List of all the dom element usefull in the html file
  dom.lang = document.getElementById("lang");
  dom.city = document.getElementById("city");
  dom.button = document.getElementById("submit");
  dom.days = document.getElementById("days");
  dom.table = document.getElementById("table");
  dom.error = document.getElementById("error");
  dom.result = document.getElementById("result");
  dom.icon = document.getElementById("icon");
  dom.min = document.getElementById("min");
  dom.max = document.getElementById("max");

  dom.lang.setAttribute("value", "English");

  // Handle the multilangual selector
  createOptions();
  dom.lang.addEventListener("change", () => {
    getLang().then((lang) => {
      wapi.setLang(lang);
      dom.button.click();
    });
  });

  // Get the current position and display the information about the weather
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      // Getting the information by the coords of one call API
      wapi
        .byLatLong({
          lat: pos.coords.latitude,
          long: pos.coords.longitude,
        })
        .then((body) => {
          // Displaying the daily forecast
          displayData(body);
          // Getting the information by the coords of forecast API
          wapi
            .byLatLong(
              {
                lat: pos.coords.latitude,
                long: pos.coords.longitude,
              },
              "forecast"
            )
            .then((forecast) => {
              // Displaying the hourly forecast
              dom.city.value = forecast.city.name.trim();
              generateTable(dom.days.children[0], forecast);
              prepareDays(forecast);
            });
        });
    },
    (err) => console.log(err),
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 0,
    }
  );

  // WHAT TO DO IF THE SUBMIT BUTTON IS CLICKED
  dom.button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    let city = (dom.city.value || "").trim().toLowerCase();
    // Making the forecast request by city name
    wapi
      .byCity(city, "forecast")
      .then((data) => {
        // Making the one call request by coords (getted from the previous request)
        wapi
          .byLatLong({ lat: data.city.coord.lat, long: data.city.coord.lon })
          .then((data) => {
            // Displying the daily forecast
            displayData(data);
          })
          .then(() => {
            // Displaying the hourly forecast getting the data from the cache map, where the data was previously stored in
            wapi.byCity(dom.city.value.toLowerCase(), "forecast").then((forecast) => {
              generateTable(dom.days.children[0], forecast);
              prepareDays(forecast);
            });
          });
      })
      .catch((err) => {
        console.error(err);
        error.innerText = err.message;
      });
  });
});

// add events listeners "click" and "mouseover" to all the days form
function prepareDays(forecast) {
  [...dom.days.children].reduce((acc, el) => {
    el.addEventListener("mouseover", () => {
      el.classList.add("liHover", 1000);
    });
    el.addEventListener("mouseout", () => {
      el.classList.remove("liHover");
    });
    el.addEventListener("click", (event) => {
      event = liParent(event);
      generateTable(event, forecast);
    });
  }, "");
}

// METHODS FOR IMPLEMENTING THE MULTILINGUAL SELECTOR
async function languagesList() {
  return fetch("Static/json/languages.json")
    .then((resp) => resp.json())
    .catch((err) => console.log(err));
}
function createOptions() {
  languagesList().then((list) => {
    dom.lang.innerHTML = Object.entries(list).reduce(
      (prev, [name, key]) =>
        (prev += `<option data-content='<img class="pr-2" src=\"https://flagcdn.com/28x21/${key.flag}.png\">${name}'>${name}</option>`),
      ""
    );

    $(dom.lang).selectpicker("refresh");
  });
}
async function getLang() {
  return languagesList().then(
    (resp) => resp[dom.lang.options[dom.lang.selectedIndex].value].abbreviation
  );
}

// Method for generating the days list
function generateStructure(data) {
  dom.days.innerHTML = Object.entries(data.daily).reduce((acc, el, i) => {
    if (i < 5) {
      el = el[1];
      return (acc += `<li class="list-group-item list ${
        timeConverter(el.dt).date
      }">
                <h6>${timeConverter(el.dt).day}</h6>
                <img id = "icon" src="https://openweathermap.org/img/wn/${
                  el.weather[0].icon
                }@2x.png">
                <div>
                    <span id="min">${Math.floor(el.temp.min)}°</span>
                    <span id="max">${Math.floor(el.temp.max)}°</span>
                </div>
                <div>${el.weather[0].description}</div>
            </li>`);
    }
    return acc;
  }, "");
}

// Method for getting the first "li" element, parent of the element passed as paramenter
function liParent(element) {
  return element.path.reduce((acc, el) => {
    if (el.nodeName === "LI") {
      acc = el;
    }
    return acc;
  }, "");
}

// Function that generate the table for displaying the hourly forecast
function generateTable(event, forecast) {
  dom.table.innerHTML = `<table class="table table-hover table-bordered" style="text - align: center;">
        <thead class="thead-light">
            <tr>
                <th scope="col">Ora</th>
                <th scope="col">Tempo</th>
                <th scope="col">Rappresentazione</th>
                <th scope="col">T (°C)</th>
                <th scope="col">Vento</th>
                <th scope="col">Tmin</th>
                <th scope="col">Tmax</th>
                <th scope="col">Pressione</th>
            </tr>
        </thead>
        <tbody>
            
        </tbody>
    </table>`;

  var flag; //flag to also fetch the next block of information in addition to the current day
  dom.table.children[0].children[1].innerHTML = = forecast.list.reduce((acc, el) => {
    if (el.dt_txt.substring(8, 10) === event.classList[2]) {
      acc += generateT(el);
      flag = true;
    } else if (flag) {
      acc += generateT(el);
      flag = false;
    }
     return acc;
  }, "");


  function generateT(el) {
    return `<tr style="display: flex, justify-content: center, align-items:center">
            <th scope="row"><span class="badge badge-primary badge-pill">${el.dt_txt.substring(11, 16)}</span></th>
            <td>${el.weather[0].description}</td>
            <td><img style="display: inline-block; width: 60px;" src="https://openweathermap.org/img/wn/${
              el.weather[0].icon
            }@2x.png" alt=""></td>
                <td>${el.main.temp}°</td>
                <td>${el.wind.speed} km/h</td>
                <td>${el.main.temp_min}°C</td>
                <td>${el.main.temp_max}°C</td>
                <td>${el.main.pressure}mb</td>
            </tr>`;
  }
}

// Function to easily handle the date in the UNIX format
function timeConverter(UNIX_timestamp) {
  const a = new Date(UNIX_timestamp * 1000);
  const months = [
    "Gennaio",
    "Febbraio",
    "Marzo",
    "Aprile",
    "Maggio",
    "Giugno",
    "Luglio",
    "Agosto",
    "Settembre",
    "Ottobre",
    "Novembre",
    "Dicembre",
  ];
  const days = [
    "Domenica",
    "Lunedì",
    "Martedì",
    "Mercoledì",
    "Giovedì",
    "Venerdì",
    "Sabato",
  ];
  const year = a.getFullYear();
  const month = months[a.getMonth()];
  const date = a.getDate();
  const hour = a.getHours();
  const min = a.getMinutes();
  const sec = a.getSeconds();
  const day = a.getDay();
  const time = days[day];
  return {
    year: year,
    month: months[month],
    date: date,
    hour: hour,
    min: min,
    sec: sec,
    day: days[day],
    time: time,
  };
}

// Changing the background basing on the weather
function generateBackground(val) {
  const background = {
    "2XX": "#37444e",
    "3XX": "#487ca5",
    "5XX": "#a2acb8",
    "6XX": "#e8e8e8",
    "7XX": "#c1bbbb",
    "800": "#84ccff",
    "8XX": "#7e8da4",
  };
  document.querySelector("body").style.backgroundColor =
    background[val == 800 ? val : Math.floor(val / 100) + "XX"] || "#000000";
}

// Display the daily weather list
function displayData(data) {
  generateStructure(data);
  generateBackground(data.daily[0].weather[0].id);
}
