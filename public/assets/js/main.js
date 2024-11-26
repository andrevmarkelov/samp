document.addEventListener('DOMContentLoaded', () => {
    // Лоадер
    const loaderWrapper = document.getElementById('loader-wrapper');
    loaderWrapper.style.display = 'flex';

    window.addEventListener('load', function () {
        loaderWrapper.style.display = 'none';
    });

    // Кнопка наверх
    const toTopBtn = document.getElementById('toTopBtn');
    const progressCircle = document.querySelector('.progress-ring__circle');

    if (toTopBtn && progressCircle) {
        const radius = progressCircle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;

        progressCircle.style.strokeDasharray = `${circumference}`;
        progressCircle.style.strokeDashoffset = `${circumference}`;

        window.addEventListener('scroll', () => {
            const scrollPosition = document.documentElement.scrollTop;
            const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const progress = scrollPosition / windowHeight;

            progressCircle.style.strokeDashoffset = `${circumference - progress * circumference}`;

            if (scrollPosition > 100) {
                toTopBtn.classList.add('visible');
            } else {
                toTopBtn.classList.remove('visible');
            }
        });

        toTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth',
            });
        });
    }
});
