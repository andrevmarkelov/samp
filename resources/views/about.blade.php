@extends('layouts.app')

@section('content')
    <div class="position-relative">
        <div class="container py-5">
            <div class="row">
                <div class="col-md-6 d-flex flex-column justify-content-center">
                    <div class="about-intro__text">
                        <h1 class="mb-3">О проекте Samp Role Play</h1>
                        <p>
                            Один из самых интересных проектов многопользовательской игры GTA San Andreas Multiplayer.
                            Увлекательные особенности игрового процесса привлекают всё больше новых игроков.
                        </p>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="about-img__container">
                        <img src="{{ asset('assets/images/about/about-intro.png') }}" alt="О проекте Samp Role Play" class="about-img">
                    </div>
                </div>
            </div>
        </div>

        <div id="particles-js"></div>
    </div>

    {{-- Стань частью нашей игры --}}
    <div class="container py-5">
        <div class="row">
            <div class="col-md-6">
                <img src="{{ asset('assets/images/about/about.png') }}" alt="" class="w-100">
            </div>

            <div class="col-md-6 d-flex flex-column justify-content-center">
                <div class="section-header mb-4">
                    <span class="section-subtitle mb-2">Стань частью нашей игры</span>
                    <h2>Выбирай свою роль, строй карьеру и управляй страной</h2>
                </div>

                <p class="about-description">
                    Мы постарались объединить лучшие элементы ролевой игры SA-MP с новыми идеями и широкими возможностями для всех игроков.
                    Поселившись в одном из городов и став полноценным гражданином, вы сможете выбрать любимую работу, а возможно, открыть свое небольшое дело и получать постоянный доход.
                    А может быть, вам захочется вступить в одну из организаций и начать карьерный рост, пока не достигнете желаемой высоты.
                    Став известным и уважаемым человеком, вы сможете вступить в ряды правительства и подать заявку на участие в президентских выборах.
                    Набрав большинство голосов населения и став президентом, вы получите возможность самостоятельно управлять страной, издавать законы и контролировать все государственные организации.
                    Это лишь один из множества вариантов, которые возможны при игре на нашем сервере. Вы всегда можете изменить свои позиции, попробовать себя в другой роли и в других ситуациях.
                </p>
            </div>
        </div>
    </div>

    {{-- Присоединяйтесь к нам --}}
    <div class="join-us mb-5">
        <div class="container">
            <div class="section-header mb-4">
                <span class="section-subtitle mb-2 text-white">Присоединяйтесь к нам</span>
                <h2 class="text-white mb-5">Тысячи игроков уже выбрали нас! Откройте для себя мир новых возможностей и захватывающих приключений</h2>
                <a href="samp://127.0.0.1:7777">Присоединиться</a>
            </div>
        </div>
    </div>

    <x-contact />
@endsection

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function () {
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
            const container = document.querySelector('.about-img__container');
            const image = document.querySelector('.about-img');

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
