document.addEventListener('DOMContentLoaded', () => {
    const screens = document.querySelectorAll('.screen');
    const bg = document.querySelector('.app-bg');
    
    let history = ['screen-home'];
    let isAnimating = false;

    function transitionScreens(currentId, targetId) {
        if (isAnimating) return;
        
        const current = document.getElementById(currentId);
        const target = document.getElementById(targetId);
        if (!target) return;

        const isCurrentLight = current ? current.classList.contains('screen-light') : false;
        const isTargetLight = target.classList.contains('screen-light');

        if (!isCurrentLight && isTargetLight) {
            // Dark → Light: деревья и горизонт улетают вверх, белая полоса дороги
            // раздувается от нижней кромки и бесшовно становится светлым фоном экрана
            isAnimating = true;

            // Контент тёмного экрана улетает вверх вместе с дорогой
            if (current) {
                current.style.transition = 'opacity 0.5s ease, transform 0.9s cubic-bezier(0.45, 0, 0.2, 1), filter 0.9s ease';
                current.style.opacity = '0';
                current.style.transform = 'translateY(-18vh)';
                current.style.filter = 'blur(4px)';
            }

            // Зум от основания полосы (CSS .zoom-in): полоса заполняет экран
            setTimeout(() => {
                if (current) current.classList.remove('active');
                bg.classList.add('zoom-in');
            }, 300);

            // Полоса стала фоном — светлый экран всплывает снизу, продолжая движение вверх
            setTimeout(() => {
                bg.classList.add('hidden');
                target.style.animation = 'none'; // без двойного fadeIn поверх transition
                target.style.opacity = '0';
                target.style.transform = 'translateY(44px)';
                target.classList.add('active');

                // Force reflow
                void target.offsetWidth;

                target.style.transition = 'opacity 0.7s ease, transform 1s cubic-bezier(0.16, 1, 0.3, 1)';
                target.style.opacity = '1';
                target.style.transform = 'translateY(0)';

                setTimeout(() => {
                    // Clean up inline styles
                    if (current) {
                        current.style.transition = '';
                        current.style.opacity = '';
                        current.style.transform = '';
                        current.style.filter = '';
                    }
                    target.style.transition = '';
                    target.style.opacity = '';
                    target.style.transform = '';
                    // animation: none НЕ сбрасываем здесь — возврат запускает CSS fadeIn
                    // заново, и экран мигает; сброс произойдёт перед следующим показом
                    isAnimating = false;
                }, 1000);
            }, 1050);

        } else if (isCurrentLight && !isTargetLight) {
            // Light → Dark: light screen sinks DOWN, road rises UP from below
            isAnimating = true;

            // Sink the current light screen down (зеркально появлению)
            if (current) {
                current.style.transition = 'opacity 0.5s ease, transform 0.7s cubic-bezier(0.4, 0, 1, 1)';
                current.style.opacity = '0';
                current.style.transform = 'translateY(44px)';
            }

            setTimeout(() => {
                if (current) current.classList.remove('active');
                // Show the road background (still off-screen from zoom-in)
                bg.classList.remove('hidden');

                // Force reflow so browser registers the zoomed state
                void bg.offsetWidth;

                // Slide road back up into view
                bg.classList.remove('zoom-in');

                // Show the target dark screen
                target.style.animation = 'none'; // без fadeIn поверх transition (и без мигания при сбросе)
                target.style.opacity = '0';
                target.classList.add('active');

                void target.offsetWidth;

                target.style.transition = 'opacity 0.6s ease 0.4s';
                target.style.opacity = '1';

                setTimeout(() => {
                    if (current) {
                        current.style.transition = '';
                        current.style.opacity = '';
                        current.style.transform = '';
                    }
                    target.style.transition = '';
                    target.style.opacity = '';
                    isAnimating = false;
                }, 1200);
            }, 500);

        } else {
            // Same type switch (light ↔ light, dark ↔ dark)
            if (current) current.classList.remove('active');
            // Пока экран скрыт, возвращаем ему штатный CSS fadeIn (мог быть
            // заглушен инлайновым animation: none в анимированных ветках)
            target.style.animation = '';
            target.classList.add('active');
            if (isTargetLight) {
                bg.classList.add('hidden');
                bg.classList.add('zoom-in');
            } else {
                bg.classList.remove('hidden');
                bg.classList.remove('zoom-in');
            }
        }
    }

    // Handle clicks
    document.querySelectorAll('[data-target]').forEach(item => {
        item.addEventListener('click', (e) => {
            if (isAnimating) return;
            const targetId = item.getAttribute('data-target');
            if (targetId) {
                const currentId = history[history.length - 1];
                history.push(targetId);
                transitionScreens(currentId, targetId);
            }
        });
    });

    // Global goBack
    window.goBack = function() {
        if (history.length > 1 && !isAnimating) {
            const currentId = history.pop();
            const targetId = history[history.length - 1];
            transitionScreens(currentId, targetId);
        }
    };

    // Initialize first screen
    const home = document.getElementById('screen-home');
    if (home) home.classList.add('active');
});
