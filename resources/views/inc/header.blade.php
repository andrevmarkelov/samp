<header class="p-3 mb-3 border-bottom">
    <div class="container">
        <div class="d-flex flex-wrap align-items-center justify-content-center justify-content-lg-start">
            <a href="{{ route('home') }}" class="d-flex align-items-center mb-2 mb-lg-0 text-dark text-decoration-none">
                <i class="bi bi-dice-4-fill"></i>
            </a>

            <ul class="nav col-12 col-lg-auto me-lg-auto mb-2 justify-content-center mb-md-0">
                <li><a href="{{ route('home') }}" class="nav-link px-2 link-secondary">Главная</a></li>
                <li><a href="#" class="nav-link px-2 link-dark">Inventory</a></li>
                <li><a href="#" class="nav-link px-2 link-dark">Customers</a></li>
                <li><a href="#" class="nav-link px-2 link-dark">Products</a></li>
            </ul>

            @if(session()->has('user'))
                <div class="dropdown text-end">
                    <a href="#" class="d-block link-dark text-decoration-none dropdown-toggle" id="dropdownUser1" data-bs-toggle="dropdown" aria-expanded="false">
                        <img src="https://github.com/mdo.png" alt="1" width="32" height="32" class="rounded-circle">
                    </a>
                    <ul class="dropdown-menu text-small" aria-labelledby="dropdownUser1" style="">
                        <li><a class="dropdown-item" href="{{ route('profile.index') }}">Профиль</a></li>
                        <li><a class="dropdown-item" href="#">Настройки</a></li>
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
                <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#loginModal">Войти</button>
            @endif
        </div>
    </div>
</header>
