<footer class="footer">
    <div class="container py-4">
        <div class="row">
            <div class="col-md-3 d-flex align-items-center justify-content-center justify-content-md-start mb-md-0 mb-4">
                <a href="{{ route('home') }}">
                    <img src="{{ asset('assets/images/logo.png') }}" width="150" alt="{{ $serverName }}">
                </a>
            </div>
            <div class="col-md-6 d-flex align-items-center justify-content-center mb-md-0 mb-4">
                <ul class="nav gap-3 justify-content-center">
                    <li class="nav-item"><a href="{{ route('home') }}" class="nav-link p-0 text-body-secondary">Главная</a></li>
                    <li class="nav-item"><a href="{{ route('news') }}" class="nav-link p-0 text-body-secondary">Новости</a></li>
                    <li class="nav-item"><a href="{{ route('shop') }}" class="nav-link p-0 text-body-secondary">Магазин</a></li>
                    <li class="nav-item"><a href="{{ route('company.about')  }}" class="nav-link p-0 text-body-secondary">О нас</a></li>
                </ul>
            </div>
            <div class="col-md-3">
                <div class="d-flex flex-column align-items-center align-items-md-end footer-contacts">
                    <h5 class="color-dark-blue text-end">Контакты</h5>

                    <a href="mailto:{{ env('CONTACT_EMAIL') }}" class="color-grey">{{ env('CONTACT_EMAIL') }}</a>

                    <div class="d-flex align-items-center justify-content-between gap-3">
                        <a href="https://discord.com/" title="Discord" class="color-grey" target="_blank"><i class="bi bi-discord"></i></a>
                        <a href="https://vk.com/" title="ВКонтакте" class="color-grey" target="_blank"><i class="bi bi-chat-heart-fill"></i></a>
                        <a href="https://www.youtube.com/" title="YouTube" class="color-grey" target="_blank"><i class="bi bi-youtube"></i></a>
                        <a href="https://telegram.org/" title="Telegram" class="color-grey" target="_blank"><i class="bi bi-telegram"></i></a>
                    </div>
                </div>
            </div>
        </div>

    </div>

    <div class="border-top">
        <div class="container py-4">
            <div class="row">
                <div class="col-md-6 d-md-block d-flex justify-content-center text-center text-md-start">
                    <div class="footer-bottom">
                        <p class="color-grey mb-0">© {{ date('Y') }} {{ $serverName }}</p>
                        <p class="color-grey mb-0">Разработка — <a href="https://markelov.by/" class="color-grey" target="_blank">markelov.by</a></p>
                    </div>
                </div>
                <div class="col-md-6 d-md-block d-flex justify-content-center">
                    <div class="d-flex flex-column align-items-md-end align-items-center footer-bottom">
                        <a href="{{ route('user.agreement') }}" class="color-grey">Пользовательское соглашение</a>
                        <a href="{{ route('privacy.policy') }}" class="color-grey">Политика конфиденциальности</a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</footer>
