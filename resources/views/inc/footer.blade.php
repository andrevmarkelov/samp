<footer class="footer">
    <div class="container py-4">
        <div class="d-flex justify-content-between align-items-center">
            <a href="{{ route('home') }}">
                <img src="{{ asset('assets/images/logo.png') }}" width="150" alt="Samp Role Play">
            </a>

            <ul class="nav gap-3">
                <li class="nav-item"><a href="{{ route('home') }}" class="nav-link p-0 text-body-secondary">Главная</a></li>
                <li class="nav-item"><a href="#" class="nav-link p-0 text-body-secondary">Новости</a></li>
                <li class="nav-item"><a href="{{ route('shop') }}" class="nav-link p-0 text-body-secondary">Магазин</a></li>
                <li class="nav-item"><a href="{{ route('about')  }}" class="nav-link p-0 text-body-secondary">О нас</a></li>
            </ul>

            <div class="footer-contacts">
                <h5 class="footer-contacts__title text-end">Контакты</h5>

                <div class="d-flex align-items-center gap-3">
                    <a href="https://discord.com/" title="Discord" class="color-grey" target="_blank"><i class="bi bi-discord"></i></a>
                    <a href="https://vk.com/" title="ВКонтакте" class="color-grey" target="_blank"><i class="bi bi-chat-heart-fill"></i></a>
                    <a href="https://www.youtube.com/" title="YouTube" class="color-grey" target="_blank"><i class="bi bi-youtube"></i></a>
                    <a href="https://telegram.org/" title="Telegram" class="color-grey" target="_blank"><i class="bi bi-telegram"></i></a>
                </div>
            </div>
        </div>
    </div>

    <div class="border-top">
        <div class="container py-4">
            <div class="d-flex justify-content-between align-items-center">
                <div class="footer-bottom">
                    <p class="color-grey mb-0">© {{ date('Y') }} Samp Role Play</p>
                    <p class="color-grey mb-0">Разработка — <a href="https://markelov.by/" class="color-grey" target="_blank">markelov.by</a></p>
                </div>

                <div class="d-flex flex-column align-items-end footer-bottom">
                    <a href="#" class="color-grey">Пользовательское соглашение</a>
                    <a href="#" class="color-grey">Политика конфиденциальности</a>
                </div>
            </div>
        </div>
    </div>
</footer>
