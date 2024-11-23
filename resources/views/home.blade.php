@extends('layouts.app')

@section('content')
    <div class="home-page">
        <div class="position-relative">
            <div class="container py-5">
                <div class="row">

                    <div class="d-flex flex-column justify-content-center align-items-start col-md-6 intro-text mb-4">
                        <h1 class="mb-3">Samp Role Play</h1>
                        <p class="mb-5">Многопользовательская онлайн игра с огромным открытым миром, в котором ты можешь стать кем захочешь!</p>
                        <a href="#howToPlay" class="btn-default">Начать игру</a>
                    </div>

                    <div class="d-flex justify-content-center align-items-center col-md-6">
                        <div class="intro-img__container">
                            <img src="{{ asset('assets/images/home-page/intro.png') }}" alt="Samp Role Play" class="intro-img">
                        </div>
                    </div>

                </div>
            </div>

            <div id="particles-js"></div>
        </div>

        {{-- Как начать играть --}}
        <div class="container py-5">
            <div class="section-header mb-5">
                <span class="section-subtitle mb-2">Как начать играть?</span>
                <h2 class="how-to-play__title">Начни своё приключение в GTA San Andreas SAMP прямо сейчас!</h2>
            </div>

            <div id="howToPlay" class="row">
                <div class="col-md-4 col-lg-3">
                    <div class="how-to-play__item mb-4">
                        <div class="mb-4 how-to-play__icon">
                            <i class="bi bi-controller"></i>
                        </div>
                        <h3>Скачай чистую версию игры</h3>
                        <p>Скачай оригинальную версию GTA San Andreas без модов</p>
                        <a href="{{ route('home') }}" class="d-flex align-items-center gap-2" target="_blank">Скачать <i class="bi bi-arrow-right"></i></a>
                    </div>
                </div>
                <div class="col-md-4 col-lg-3">
                    <div class="how-to-play__item mb-4">
                        <div class="mb-4 how-to-play__icon">
                            <i class="bi bi-aspect-ratio"></i>
                        </div>
                        <h3>Используй наш лаунчер</h3>
                        <p>Установи наш лаунчер для быстрого старта без дополнительных настроек</p>
                        <a href="{{ route('home') }}" class="d-flex align-items-center gap-2" target="_blank">Скачать <i class="bi bi-arrow-right"></i></a>
                    </div>
                </div>
                <div class="col-md-4 col-lg-3">
                    <div class="how-to-play__item mb-4">
                        <div class="mb-4 how-to-play__icon">
                            <i class="bi bi-cloud-download"></i>
                        </div>
                        <h3>Установи SAMP 0.3.7</h3>
                        <p>Загрузите последнюю версию клиента SAMP для подключения к серверу</p>
                        <a href="{{ route('home') }}" class="d-flex align-items-center gap-2" target="_blank">Скачать <i class="bi bi-arrow-right"></i></a>
                    </div>
                </div>
                <div class="col-md-4 col-lg-3">
                    <div class="how-to-play__item mb-4">
                        <div class="mb-4 how-to-play__icon">
                            <i class="bi bi-check2-square"></i>
                        </div>
                        <h3>Укажи IP-адрес</h3>
                        <p>Введи IP-адрес 127.0.0.1:7777 в настройках клиента SAMP</p>
                        <a href="samp://127.0.0.1:7777" class="d-flex align-items-center gap-2" target="_blank">Открыть <i class="bi bi-arrow-right"></i></a>
                    </div>
                </div>
            </div>
        </div>

        {{-- Что такое Role Play --}}
        <div class="container py-5">
            <div class="row">
                <div class="col-md-6">
                    <img src="{{ asset('assets/images/home-page/what-is-rp.png') }}" alt="Что такое Role Play" class="mb-3 w-100">
                </div>
                <div class="d-flex flex-column justify-content-center roleplay-info col-md-6">
                    <div class="section-header mb-4">
                        <span class="section-subtitle mb-2">Что такое Role Play?</span>
                        <h2>Погружение в мир SAMP: выбери свою роль и стань частью истории</h2>
                    </div>
                    <p>
                        <strong>Ролевая игра (role-play)</strong> - Это режим игры, в котором игроки отыгрывают роли определённых персонажей. Ролей гораздо больше,
                        чем вы можете себе представить, вас ограничивает только ваше воображение! Начав играть в Samp Role Play,
                        вам предстоит придерживаться игровой концепции: вести себя в соответствии с характером и историей своего персонажа.
                    </p>
                    <p>
                        После регистрации и первого входа в игру, вы становитесь законопослушным гражданином штата San Andreas.
                        Отсюда начинается ваш увлекательный путь, и дальнейшая судьба персонажа зависит только от ваших решений.
                        Остаться законопослушным гражданином, вступив в государственную организацию, или стать частью криминального мира,
                        постепенно завоевывая авторитет? Выбор зависит только от вас!
                    </p>
                </div>
            </div>
        </div>

        {{-- Почему именно мы --}}
        <div class="container py-5">
            <div class="row">
                <div class="d-flex flex-column justify-content-center col-md-6">
                    <div class="section-header mb-4">
                        <span class="section-subtitle mb-2">Почему именно мы?</span>
                        <h2>Узнайте, что выделяет наш сервер среди других и делает игру незабываемой</h2>
                    </div>

                    <div class="why-we__accordion">
                        <div class="accordion-item mb-3">
                            <div class="accordion-header active"><i class="bi bi-arrow-down-short"></i> Уникальный игровой мод</div>
                            <div class="accordion-content ms-4 active">
                                Наш сервер предлагает эксклюзивные игровые возможности, тщательно продуманные механики и
                                уникальные системы, которые делают каждую сессию незабываемой. Здесь вы найдете то, чего нет на других серверах!
                            </div>
                        </div>

                        <div class="accordion-item mb-3">
                            <div class="accordion-header"><i class="bi bi-arrow-down-short"></i> Стабильный и активный онлайн</div>
                            <div class="accordion-content ms-4">
                                У нас всегда есть с кем играть! Постоянно высокий онлайн и дружное комьюнити создают атмосферу,
                                в которой легко найти новых друзей или союзников для захватывающих приключений.
                            </div>
                        </div>

                        <div class="accordion-item mb-3">
                            <div class="accordion-header"><i class="bi bi-arrow-down-short"></i> Активная администрация и справедливость</div>
                            <div class="accordion-content ms-4">
                                Наша команда администраторов всегда на связи, чтобы поддерживать порядок и обеспечивать комфорт
                                для каждого игрока. Справедливое решение любых споров — наша главная задача.
                            </div>
                        </div>

                        <div class="accordion-item mb-3">
                            <div class="accordion-header"><i class="bi bi-arrow-down-short"></i> Интересные мероприятия и захватывающий РП-сценарий</div>
                            <div class="accordion-content ms-4">
                                Регулярные ивенты, конкурсы, а также яркие ролевые ситуации добавляют динамики и погружают
                                в уникальный мир игры, где каждый может проявить свои таланты.
                            </div>
                        </div>
                    </div>

                </div>
                <div class="col-md-6">
                    <img src="{{ asset('assets/images/home-page/why-we.png') }}" alt="Почему именно мы" class="w-100">
                </div>
            </div>
        </div>

        {{-- Присоединяйтесь к нам --}}
        <div class="join-us mb-5">
            <div class="container">
                <div class="row">
                    <div class="col-md-9">
                        <div class="section-header mb-4">
                            <span class="section-subtitle mb-2 text-white">Присоединяйтесь к нам</span>
                            <h2 class="text-white mb-5">Тысячи игроков уже выбрали нас! Откройте для себя мир новых возможностей и захватывающих приключений</h2>
                            <a href="samp://127.0.0.1:7777">Присоединиться</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {{-- Новости --}}
        <div class="container py-5">
            <div class="row mb-5">
                <div class="col-md-8">
                    <div class="section-header">
                        <span class="section-subtitle mb-2">Все важные обновления и события</span>
                        <h2>Будьте в курсе всех новостей, обновлений и предстоящих мероприятий на сервере!</h2>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-4">
                    <div class="news-item mb-4">
                        <a href="{{ route('home') }}" class="d-block news-item__image mb-3">
                            <img src="{{ asset('/assets/images/home-page/join-us.webp') }}" alt="News Title">
                        </a>
                        <a href="{{ route('home') }}" class="news-item__title mb-2">Ligula tristique quis risus risus</a>
                        <p class="news-item__description">
                            Mauris convallis non ligula non interdum. Gravida vulputate convallis tempus vestibulum cras
                            imperdiet nun eu dolor. Aenean lacinia bibendum nulla sed.
                        </p>
                        <div class="d-flex justify-content-end align-items-center gap-2 news-item__date">
                            <i class="bi bi-calendar3"></i>
                            <span>19.11.2024</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="news-item mb-4">
                        <a href="{{ route('home') }}" class="d-block news-item__image mb-3">
                            <img src="{{ asset('/assets/images/home-page/join-us.webp') }}" alt="News Title">
                        </a>
                        <a href="{{ route('home') }}" class="news-item__title mb-2">Ligula tristique quis risus Ligula tristique quis risus</a>
                        <p class="news-item__description">
                            Mauris convallis non ligula non interdum. Gravida vulputate convallis tempus vestibulum cras
                            imperdiet nun eu dolor. Aenean lacinia bibendum nulla sed. Mauris convallis non ligula non
                            interdum. Gravida vulputate convallis tempus vestibulum cras imperdiet nun eu dolor.
                            Aenean lacinia bibendum nulla sed.
                        </p>
                        <div class="d-flex justify-content-end align-items-center gap-2 news-item__date">
                            <i class="bi bi-calendar3"></i>
                            <span>19.11.2024</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="news-item mb-4">
                        <a href="{{ route('home') }}" class="d-block news-item__image mb-3">
                            <img src="{{ asset('/assets/images/home-page/join-us.webp') }}" alt="News Title">
                        </a>
                        <a href="{{ route('home') }}" class="news-item__title mb-2">Ligula tristique quis risus</a>
                        <p class="news-item__description">
                            Mauris convallis non ligula non interdum. Gravida vulputate convallis tempus vestibulum cras
                            imperdiet nun eu dolor. Aenean lacinia bibendum nulla sed. imperdiet nun eu dolor. Aenean lacinia bibendum nulla sed.
                            imperdiet nun eu dolor. Aenean lacinia bibendum nulla sed.
                        </p>
                        <div class="d-flex justify-content-end align-items-center gap-2 news-item__date">
                            <i class="bi bi-calendar3"></i>
                            <span>19.11.2024</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="d-flex justify-content-center align-items-center mt-5">
                <a href="{{ route('home') }}" class="btn-default">Все новости</a>
            </div>
        </div>

        <x-contact />
    </div>
@endsection

@push('scripts')
    <script>
        document.addEventListener("DOMContentLoaded", function () {
            // Particles анимация
            const particlesContainer = document.getElementById("particles-js");
            if (particlesContainer) {
                particlesJS("particles-js", {
                    "particles": {
                        "number": {
                            "value": 80,
                            "density": {
                                "enable": true,
                                "value_area": 800
                            }
                        },
                        "color": {
                            "value": "#262b32"
                        },
                        "shape": {
                            "type": "circle"
                        },
                        "opacity": {
                            "value": 0.5
                        },
                        "size": {
                            "value": 3,
                            "random": true
                        },
                        "line_linked": {
                            "enable": true,
                            "distance": 100,
                            "color": "#262b32",
                            "opacity": 0.4,
                            "width": 1
                        },
                        "move": {
                            "enable": true,
                            "speed": 6,
                            "out_mode": "out"
                        }
                    },
                    "interactivity": {
                        "detect_on": "canvas",
                        "events": {
                            "onhover": {
                                "enable": false
                            },
                            "onclick": {
                                "enable": false
                            },
                            "resize": true
                        }
                    }
                });
            }

            // Анимация при наведении на картинку
            const container = document.querySelector('.intro-img__container');
            const image = document.querySelector('.intro-img');

            container.addEventListener('mousemove', (e) => {
                const rect = container.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const xPercent = (x / rect.width - 0.5) * 2;
                const yPercent = (y / rect.height - 0.5) * 2;

                const maxTilt = 15;
                const tiltX = maxTilt * -yPercent;
                const tiltY = maxTilt * xPercent;

                image.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
            });

            container.addEventListener('mouseleave', () => {
                image.style.transform = "rotateX(0deg) rotateY(0deg)";
            });

            // Аккордеон
            const headers = document.querySelectorAll('.why-we__accordion .accordion-header');

            headers.forEach(header => {
                header.addEventListener('click', () => {
                    const allContents = document.querySelectorAll('.why-we__accordion .accordion-content');
                    const allHeaders = document.querySelectorAll('.why-we__accordion .accordion-header');

                    allContents.forEach(content => content.classList.remove('active'));
                    allHeaders.forEach(h => h.classList.remove('active'));

                    const content = header.nextElementSibling;

                    if (content) {
                        content.classList.add('active');
                        header.classList.add('active');
                    }
                });
            });
        });
    </script>
@endpush

