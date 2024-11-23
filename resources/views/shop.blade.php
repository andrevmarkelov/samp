@extends('layouts.app')

@section('content')
    <div class="position-relative">
        <div class="container py-5">
            <div class="row">
                <div class="col-md-6 d-flex align-items-center">
                    <div class="shop-intro">
                        <h1 class="mb-3">Магазин</h1>
                        <p class="color-grey">На этой странице вы можете быстро и удобно пополнить баланс своего игрового аккаунта.
                            После завершения оплаты средства мгновенно зачисляются на ваш игровой счёт.</p>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="shop-img__container">
                        <img src="{{ asset('assets/images/shop/shop-img.png') }}" alt="Магазин" class="shop-img">
                    </div>
                </div>
            </div>
        </div>

        <div id="particles-js"></div>
    </div>

    {{-- Форма оплаты --}}
    <div class="container py-5">
        <div class="row justify-content-center">
            <div class="col-md-5">
                <h2 class="text-center mb-4 payment-form__title">Пополнить баланс</h2>

                <form id="paymentForm" action="{{ route('payment') }}" method="POST">
                    @csrf
                    <div class="mb-3">
                        <label for="p_username" class="form-label">Никнейм</label>
                        <input type="text" class="form-control" id="p_username" name="username" placeholder="Игровой никнейм" required>
                    </div>
                    <div class="mb-3">
                        <label for="p_email" class="form-label">Email</label>
                        <input type="email" class="form-control" id="p_email" name="email" placeholder="Введите почту" required>
                    </div>
                    <div class="mb-3">
                        <label for="amount" class="form-label">Сумма пополнения</label>
                        <input type="number" class="form-control" id="p_amount" name="amount" placeholder="Введите сумму" min="1" required>
                    </div>

                    <button type="submit" class="btn-default">Оплатить</button>

                    <small class="d-block text-primary-emphasis mt-2">
                        Нажимая на кнопку "Оплатить", Вы подтверждаете, что находитесь в здравом уме и трезвом состоянии.
                        Мы призываем быть ответственными: если у Вас есть финансовые затруднения, пожалуйста, воздержитесь от оплаты.
                    </small>
                </form>
            </div>
        </div>
    </div>

    {{-- Оплата не прошла --}}
    <div class="shop-info py-5 mb-5">
        <div class="container">
            <div class="row">
                <div class="col-md-6">
                    <div class="section-header mb-4">
                        <span class="section-subtitle mb-2">Оплата не прошла?</span>
                        <h2>Возникли проблемы с платежом? Мы поможем их решить.</h2>
                    </div>

                    <p class="color-grey">
                        Если средства были списаны, но не зачислены, пожалуйста, свяжитесь с нами. Мы рассмотрим Ваше
                        обращение в кратчайшие сроки и постараемся устранить проблему
                    </p>
                </div>
            </div>
        </div>
    </div>

    <x-contact />
@endsection

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function() {
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
            const container = document.querySelector('.shop-img__container');
            const image = document.querySelector('.shop-img');

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

            // Форма оплаты
            document.getElementById('paymentForm').addEventListener('submit', async (event) => {
               event.preventDefault();

                const form = new FormData(event.target);
                const username = form.get('username');
                const email = form.get('email');
                const amount  = form.get('amount');

                try {
                    const response = await axios.post('/shop', { username, email, amount }, {
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest',
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                        }
                    });

                    if (response.status === 200) {
                        const successText = document.createElement('div');
                        successText.className = 'alert alert-success';
                        successText.textContent = response.data.status;
                        event.target.parentNode.prepend(successText);
                    }

                } catch (error) {
                    if (error.response && error.response.status === 422){
                        const errors = error.response.data.errors;

                        for (const field in errors) {
                            const fieldElement = document.getElementById(`p_${field}`);

                            if (fieldElement) {
                                fieldElement.classList.add('is-invalid');
                                const errorText = document.createElement('div');
                                errorText.className = 'text-danger';
                                errorText.textContent = errors[field][0];
                                fieldElement.parentNode.appendChild(errorText);
                            }
                        }
                    } else {
                        console.error('Ошибка сервера:', error);
                    }
                }
            });
        });
    </script>
@endpush
