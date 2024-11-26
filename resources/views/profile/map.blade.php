@extends('layouts.profile')

@section('profile-content')
    <div class="d-flex flex-column align-items-center">
        <h1 class="h3 mb-3">Карта сервера</h1>
        <canvas class="canvas-map" width="700" height="700"></canvas>
    </div>
@endsection

@push('scripts')
    <script>
        const canvas = document.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.src = '/assets/images/profile/map.jpg';

        const houses = @json($houses);
        const businesses = @json($business);

        const icons = {
            houseForSale: '/assets/images/profile/house-green.png',
            houseOwned: '/assets/images/profile/house-red.png',
            businessForSale: '/assets/images/profile/business-green.png',
            businessOwned: '/assets/images/profile/business-red.png',
        };

        const loadedIcons = {};
        for (const [key, src] of Object.entries(icons)) {
            loadedIcons[key] = new Image();
            loadedIcons[key].src = src;
        }

        const dpr = window.devicePixelRatio || 1;
        canvas.width = 700 * dpr;
        canvas.height = 700 * dpr;
        ctx.scale(dpr, dpr);

        let scale = 1;
        let posX = 0, posY = 0;
        let minScale, maxScale = 2;
        let drag = false, startX, startY;
        let isZooming = false;

        img.onload = () => {
            minScale = Math.max(canvas.width / img.width, canvas.height / img.height);
            scale = minScale;

            posX = (canvas.width - img.width * scale) / 2;
            posY = (canvas.height - img.height * scale) / 2;

            draw();
        };

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, posX, posY, img.width * scale, img.height * scale);

            drawMarkers(houses, 'house');
            drawMarkers(businesses, 'business');
        }

        function drawMarkers(places, type) {
            places.forEach(place => {
                const { entrance_x, entrance_y, user } = place;
                const pixelCoords = gameToPixel(entrance_x, entrance_y);

                const icon =
                    type === 'house'
                        ? user ? loadedIcons.houseOwned : loadedIcons.houseForSale
                        : user ? loadedIcons.businessOwned : loadedIcons.businessForSale;

                ctx.drawImage(icon, pixelCoords.x - 10, pixelCoords.y - 10, 20, 20);
            });
        }

        function gameToPixel(gameX, gameY) {
            const pixelX = ((gameX - 0 + 3000) / 6000) * img.width;
            const pixelY = ((3000 - gameY) / 6000) * img.height;

            return {
                x: pixelX * scale + posX,
                y: pixelY * scale + posY
            };
        }

        function clampPosition() {
            posX = Math.min(0, Math.max(posX, canvas.width - img.width * scale));
            posY = Math.min(0, Math.max(posY, canvas.height - img.height * scale));
        }

        const tooltip = document.createElement('div');
        tooltip.style.position = 'absolute';
        tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        tooltip.style.color = 'white';
        tooltip.style.padding = '10px';
        tooltip.style.borderRadius = '5px';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.display = 'none';
        tooltip.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        document.body.appendChild(tooltip);

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
            const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);

            let found = false;

            [...houses, ...businesses].forEach(place => {
                const { id, name, description, price, user, entrance_x, entrance_y } = place;
                const pixelCoords = gameToPixel(entrance_x, entrance_y);

                const distance = Math.sqrt(
                    (mouseX - pixelCoords.x) ** 2 + (mouseY - pixelCoords.y) ** 2
                );

                if (distance <= 10 * scale) {
                    tooltip.innerHTML = `
                        <strong>№</strong>${id}<br>
                        <strong>Название:</strong> ${name || 'Не указано'}<br>
                        ${description ? `<strong>Описание:</strong> ${description}<br>` : ''}
                        <strong>Цена:</strong> ${price}$<br>
                        ${user ? `<strong>Владелец:</strong> ${user.username}` : ''}`;

                    tooltip.style.left = `${e.pageX + 10}px`;
                    tooltip.style.top = `${e.pageY + 10}px`;
                    tooltip.style.display = 'block';
                    tooltip.style.opacity = '1';
                    tooltip.style.transform = 'scale(1)';
                    found = true;
                }
            });

            if (!found) {
                tooltip.style.opacity = '0';
                tooltip.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    if (tooltip.style.opacity === '0') tooltip.style.display = 'none';
                }, 200);
            }
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();

            if (!isZooming) {
                requestAnimationFrame(() => {
                    const mouseX = e.clientX - canvas.offsetLeft;
                    const mouseY = e.clientY - canvas.offsetTop;

                    const oldScale = scale;
                    const zoomAmount = -e.deltaY * 0.001;

                    scale = Math.min(Math.max(minScale, scale + zoomAmount), maxScale);

                    posX -= (mouseX - posX) * (scale - oldScale) / oldScale;
                    posY -= (mouseY - posY) * (scale - oldScale) / oldScale;

                    clampPosition();
                    draw();
                    isZooming = false;
                });
                isZooming = true;
            }
        }, { passive: false });

        canvas.onmousedown = (e) => {
            e.preventDefault();
            drag = true;
            startX = e.clientX - posX;
            startY = e.clientY - posY;
        };

        canvas.onmousemove = (e) => {
            if (drag) {
                posX = e.clientX - startX;
                posY = e.clientY - startY;
                clampPosition();
                draw();
            }
        };

        canvas.onmouseup = () => (drag = false);
        canvas.onmouseleave = () => (drag = false);
    </script>
@endpush
