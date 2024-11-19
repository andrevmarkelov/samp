@extends('layouts.app')

@section('content')
    <div class="home-page">
        <div class="position-relative">
            <div class="container py-5">
                <div class="row">

                    <div class="d-flex flex-column justify-content-center align-items-start col-md-6 intro-text mb-3">
                        <h1 class="mb-3">Samp Role Play</h1>
                        <p class="mb-5">Многопользовательская онлайн игра с огромным открытым миром, в котором ты можешь стать кем захочешь!</p>
                        <a href="#howToPlay" class="p-2">Начать игру</a>
                    </div>

                    <div class="d-flex justify-content-center align-items-center col-md-6">
                        <div class="intro-img__container">
                            <img src="{{ asset('assets/images/home-page/intro.png') }}" alt="1" class="intro-img">
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
                    <div class="how-to-play__item mb-3">
                        <div class="mb-4 how-to-play__icon">
                            <i class="bi bi-controller"></i>
                        </div>
                        <h3>Скачай чистую версию игры</h3>
                        <p>Скачай оригинальную версию GTA San Andreas без модов</p>
                        <a href="{{ route('home') }}" class="d-flex align-items-center gap-2" target="_blank">Скачать <i class="bi bi-arrow-right"></i></a>
                    </div>
                </div>
                <div class="col-md-4 col-lg-3">
                    <div class="how-to-play__item mb-3">
                        <div class="mb-4 how-to-play__icon">
                            <i class="bi bi-aspect-ratio"></i>
                        </div>
                        <h3>Используй наш лаунчер</h3>
                        <p>Установи наш лаунчер для быстрого старта без дополнительных настроек</p>
                        <a href="{{ route('home') }}" class="d-flex align-items-center gap-2" target="_blank">Скачать <i class="bi bi-arrow-right"></i></a>
                    </div>
                </div>
                <div class="col-md-4 col-lg-3">
                    <div class="how-to-play__item mb-3">
                        <div class="mb-4 how-to-play__icon">
                            <i class="bi bi-cloud-download"></i>
                        </div>
                        <h3>Установи SAMP 0.3.7</h3>
                        <p>Загрузите последнюю версию клиента SAMP для подключения к серверу</p>
                        <a href="{{ route('home') }}" class="d-flex align-items-center gap-2" target="_blank">Скачать <i class="bi bi-arrow-right"></i></a>
                    </div>
                </div>
                <div class="col-md-4 col-lg-3">
                    <div class="how-to-play__item mb-3">
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
        });
    </script>
@endpush

