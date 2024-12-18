@extends('layouts.app')

@section('content')
    <div class="news-page">
        <div class="news-page__intro">
            <div class="position-relative">
                <div class="container py-5">
                    <div class="row">
                        <div class="col-md-5">
                            <h1 class="color-dark-blue">Новости</h1>
                            <p class="color-grey">Все обновления, события и важные анонсы в одном месте. Узнайте, чем живет наш сервер и какие планы нас ждут в будущем!</p>
                        </div>
                    </div>
                </div>

                <div id="particles-js"></div>
            </div>
        </div>

        <div class="container py-5">
            @if ($news->isNotEmpty())
                <div class="row">
                    @foreach ($news as $item)
                        <x-news-card :news="$item" />
                    @endforeach
                </div>

                {{ $news->links('inc.pagination') }}

            @else
                <p class="text-center mt-5">Пока нет новых новостей. Заглядывайте сюда позже, чтобы быть в курсе всех событий!</p>
            @endif
        </div>
    </div>
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
        });
    </script>
@endpush
