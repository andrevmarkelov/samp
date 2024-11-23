<header class="p-3 border-bottom">
    <div class="container">
        <div class="d-flex flex-wrap align-items-center justify-content-center justify-content-lg-start">
            <a href="{{ route('home') }}" class="d-flex align-items-center mb-2 mb-lg-0 text-dark text-decoration-none me-4">
                <img src="{{ asset('assets/images/logo.png') }}" width="100" alt="{{ $serverName }}">
            </a>

            <ul class="nav col-12 col-lg-auto me-lg-auto mb-2 justify-content-center mb-md-0">
                <li><a href="{{ route('home') }}" class="nav-link px-2 link-dark">Главная</a></li>
                <li><a href="#" class="nav-link px-2 link-dark">Новости</a></li>
                <li><a href="{{ route('shop') }}" class="nav-link px-2 link-dark">Магазин</a></li>
                <li><a href="{{ route('company.about')  }}" class="nav-link px-2 link-dark">О нас</a></li>
            </ul>

            @if(session()->has('user'))
                <div class="dropdown text-end">
                    <a href="#" class="d-block link-dark text-decoration-none dropdown-toggle" id="dropdownUser1" data-bs-toggle="dropdown" aria-expanded="false">
                        <img src="{{ asset('assets/images/skins/' . $user->p_skin . '.png') }}" alt="1" width="40" height="40" class="rounded-circle me-2">
                        {{ $user->username }}
                    </a>
                    <ul class="dropdown-menu text-small" aria-labelledby="dropdownUser1" style="">
                        <li><a class="dropdown-item" href="{{ route('profile.index') }}">Личный кабинет</a></li>
                        <li><a class="dropdown-item" href="{{ route('profile.payment.history') }}">История платежей</a></li>
                        <li><a class="dropdown-item" href="{{ route('profile.map') }}">Карта сервера</a></li>
                        <li><a class="dropdown-item" href="{{ route('profile.settings') }}">Настройки</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li>
                            <form action="{{ route('profile.logout') }}" method="POST">
                                @csrf
                                <button type="submit" class="dropdown-item"><i class="bi bi-box-arrow-left"></i> Выход</button>
                            </form>
                        </li>
                    </ul>
                </div>
            @else
                <button class="btn-default" data-bs-toggle="modal" data-bs-target="#loginModal">Войти</button>
            @endif
        </div>
    </div>
</header>
