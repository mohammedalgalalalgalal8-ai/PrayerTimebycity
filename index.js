
  const cityInput = document.querySelector('.form-control'); 
  const searchBtn = document.querySelector('.btn-main');
  const locationBtn = document.querySelector('.btn-outline-success');
  const refreshBtn = document.querySelector('.btn-outline-secondary');

  const cityElem = document.querySelector('.city');
  const dateElem = document.querySelector('.date');
  const mainPrayerElem = document.querySelector('.main-time h4');
  const countdownElem = document.querySelector('.countdown');
  const mainSmall = document.querySelector('.main-time small');
  const currentTimeElem = document.querySelector('.text-muted');
  const timeBoxes = document.querySelectorAll('.time-box span');

  let currentTimings = null;
  let countdownInterval = null;
  let currentTimeInterval = null;

  function parseTimeString(timeStr) {
    if (!timeStr) return null;
    const m = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return [parseInt(m[1], 10), parseInt(m[2], 10)];
  }

async function getPrayerTimes(city) {
  try {
 
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`
    );
    const geoData = await geoRes.json();

    if (!geoData || geoData.length === 0) {
      alert("❌  تأكد من كتابة الاسم بشكل صحيح ");
      return;
    }

    // 🔹 نأخذ أول نتيجة
    const { lat, lon, display_name } = geoData[0];

    // 🔹 نستخدم الإحداثيات لجلب أوقات الصلاة من Aladhan
    const res = await fetch(
      `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=3`
    );
    const data = await res.json();

    if (!data || data.code !== 200 || !data.data || !data.data.timings) {
      alert("⚠️ تعذر جلب أوقات الصلاة، حاول مرة أخرى");
      return;
    }

    const timings = data.data.timings;
    currentTimings = timings;

    const date = data.data.date.readable;
    const hijri = data.data.date.hijri.date;
    const weekday = data.data.date.hijri.weekday.ar;

    cityElem.textContent = display_name;
    dateElem.textContent = `${weekday} ${hijri} هـ الموافق ${date}`;

    const timeValues = [
      timings.Fajr, timings.Sunrise, timings.Dhuhr,
      timings.Asr, timings.Maghrib, timings.Isha
    ];

    timeBoxes.forEach((box, i) => (box.textContent = timeValues[i] ?? "--:--"));

    startCurrentTimeUpdater(display_name);
    determineNextPrayer(timings);
  } catch (err) {
    console.error(err);
    alert("حدث خطأ أثناء جلب بيانات المدينة، حاول مرة أخرى");
  }
}


  async function getPrayerTimesByLocation(lat, lon) {
    try {
      const res = await fetch(`https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=2`);
      const data = await res.json();
      if (!data || data.code !== 200 || !data.data || !data.data.timings) throw new Error('API error');

      const timings = data.data.timings;
      currentTimings = timings;

      const date = data.data.date.readable;
      const hijri = data.data.date.hijri.date;
      const weekday = data.data.date.hijri.weekday.ar;

      cityElem.textContent = "موقعك الحالي";
      dateElem.textContent = `${weekday} ${hijri} هـ الموافق ${date}`;

      const timeValues = [
        timings.Fajr, timings.Sunrise, timings.Dhuhr,
        timings.Asr, timings.Maghrib, timings.Isha
      ];

      timeBoxes.forEach((box, i) => box.textContent = timeValues[i] ?? '--:--');

      startCurrentTimeUpdater("موقعك");
      determineNextPrayer(timings);

    } catch (err) {
      console.error(err);
      getPrayerTimes("Taiz"); 
    }
  }

  function startCurrentTimeUpdater(city) {
    if (currentTimeInterval) clearInterval(currentTimeInterval);
    currentTimeInterval = setInterval(() => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("ar-EG");
      currentTimeElem.innerHTML = `الوقت الآن في ${city}: <br>${timeStr}`;
    }, 1000);
  }

  function determineNextPrayer(timings) {
    const now = new Date();
    const prayers = [
      { name: "الفجر", time: timings.Fajr },
      { name: "الظهر", time: timings.Dhuhr },
      { name: "العصر", time: timings.Asr },
      { name: "المغرب", time: timings.Maghrib },
      { name: "العشاء", time: timings.Isha }
    ];

    let nextPrayer = null;
    let minDiff = Infinity;

    prayers.forEach(prayer => {
      const parsed = parseTimeString(prayer.time);
      if (!parsed) return;
      const [h, m] = parsed;

      const prayerDate = new Date();
      prayerDate.setHours(h, m, 0, 0);

      let diff = prayerDate - now;
      if (diff <= 0) diff += 24 * 60 * 60 * 1000;

      if (diff < minDiff) {
        minDiff = diff;
        nextPrayer = prayer;
      }
    });

    if (!nextPrayer) return;

    mainPrayerElem.textContent = nextPrayer.name;
    mainSmall.textContent = `يبقى على صلاة ${nextPrayer.name}`;
    startCountdownForPrayer(nextPrayer.name, nextPrayer.time, timings);
  }

  function startCountdownForPrayer(prayerName, prayerTimeStr, timings) {
    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
      const now = new Date();
      const parsed = parseTimeString(prayerTimeStr);
      if (!parsed) {
        countdownElem.textContent = "--:--:--";
        return;
      }
      const [h, m] = parsed;

      const prayerDate = new Date();
      prayerDate.setHours(h, m, 0, 0);

      let diff = prayerDate - now;
      if (diff <= 0) diff += 24 * 60 * 60 * 1000;

      if (diff <= 1000) {
        clearInterval(countdownInterval);
        determineNextPrayer(currentTimings || timings);
        return;
      }

      const hours = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, '0');
      const minutes = String(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
      const seconds = String(Math.floor((diff % (1000 * 60)) / 1000)).padStart(2, '0');
      countdownElem.textContent = `${hours}:${minutes}:${seconds}`;
    }, 1000);
  }

  window.addEventListener("load", () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => getPrayerTimesByLocation(pos.coords.latitude, pos.coords.longitude),
        (err) => {
          console.warn("geolocation failed or denied:", err && err.message);
          getPrayerTimes("Taiz");
        },
        { timeout: 7000 }
      );
    } else {
      getPrayerTimes("Taiz");
    }
  });

  searchBtn.addEventListener("click", () => {
    const city = cityInput.value.trim();
    if (!city) {
      alert("أدخل اسم المدينة");
      return;
    }
    getPrayerTimes(city);
    cityInput.value = "";
  });

  locationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      getPrayerTimes("Taiz");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => getPrayerTimesByLocation(pos.coords.latitude, pos.coords.longitude),
      err => getPrayerTimes("Taiz"),
      { timeout: 10000 }
    );
  });

  refreshBtn.addEventListener("click", () => {
    location.reload();
  });

