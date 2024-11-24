@props(['news'])

<div class="col-md-4">
    <div class="news-item mb-4">
        <a href="{{ route('news.show', $news->slug) }}" class="d-block news-item__image mb-3">
            <img src="{{ asset('storage/' . $news->image) }}" alt="{{ $news->title }}">
        </a>
        <a href="{{ route('news.show', $news->slug) }}" class="news-item__title mb-2">{{ $news->title }}</a>
        <p class="news-item__description">{{ $news->short_description }}</p>
        <div class="d-flex justify-content-between align-items-center gap-3 news-item__footer">
            <div class="d-flex align-items-center gap-2">
                <i class="bi bi-person"></i>
                <span>{{ $serverName }}</span>
            </div>

            <div class="d-flex align-items-center gap-2">
                <i class="bi bi-calendar3"></i>
                <span>{{ $news->created_at->format('d.m.Y') }}</span>
            </div>
        </div>
    </div>
</div>
