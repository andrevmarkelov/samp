<div class="d-flex flex-column align-items-center gap-2 mb-4">
    <img src="{{ asset('assets/images/skins/' . $p_skin . '.png') }}" alt="{{ $username }}" width="131" height="131" class="rounded-circle">
    <p class="fw-bold">{{ $username }}</p>
</div>

<ul class="profile-menu">
    <li class="mb-2"><a href="{{ route('profile.index') }}">Личный кабинет</a></li>
    <li class="mb-2"><a href="{{ route('profile.settings') }}">Магазин</a></li>
    <li class="mb-2"><a href="{{ route('profile.settings') }}">Настройки</a></li>
    <li>
        <form action="{{ route('profile.logout') }}" method="POST">
            @csrf
            <button type="submit">Выход</button>
        </form>
    </li>
</ul>
