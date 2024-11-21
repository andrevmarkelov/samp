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

            drawMarkers(houses, 'red');
            drawMarkers(businesses, 'blue');
        }

        function drawMarkers(places, color) {
            places.forEach(place => {
                const { entrance_x, entrance_y } = place;
                const pixelCoords = gameToPixel(entrance_x, entrance_y);

                ctx.beginPath();
                ctx.arc(pixelCoords.x, pixelCoords.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.closePath();

                ctx.fillStyle = "white";
                ctx.font = "12px Arial";
                ctx.fillText(place.name, pixelCoords.x + 8, pixelCoords.y - 8);
                // debug
                ctx.fillText(`${place.name} (${Math.round(pixelCoords.x)}, ${Math.round(pixelCoords.y)})`, pixelCoords.x + 8, pixelCoords.y - 8);
            });
        }

        function gameToPixel(gameX, gameY) {
            // TODO: Fixed -0
            const pixelX = ((gameX-0 + 3000) / 6000) * img.width;
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

        canvas.addEventListener("wheel", (e) => {
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
