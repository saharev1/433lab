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
            // Dark → Light: road slides DOWN, light screen rises UP
            isAnimating = true;

            // Fade out the current dark screen (menu)
            if (current) {
                current.style.transition = 'opacity 0.4s ease, transform 0.6s ease';
                current.style.opacity = '0';
                current.style.transform = 'translateY(-30px)';
            }

            // After menu fades, slide the road down
            setTimeout(() => {
                if (current) current.classList.remove('active');
                bg.classList.add('zoom-in');
            }, 300);

            // After road slides away, show the light screen rising up
            setTimeout(() => {
                bg.classList.add('hidden');
                target.style.opacity = '0';
                target.style.transform = 'translateY(-60px)';
                target.classList.add('active');

                // Force reflow
                void target.offsetWidth;

                target.style.transition = 'opacity 0.6s ease, transform 0.8s cubic-bezier(0.2, 0, 0.2, 1)';
                target.style.opacity = '1';
                target.style.transform = 'translateY(0)';

                setTimeout(() => {
                    // Clean up inline styles
                    if (current) {
                        current.style.transition = '';
                        current.style.opacity = '';
                        current.style.transform = '';
                    }
                    target.style.transition = '';
                    target.style.opacity = '';
                    target.style.transform = '';
                    isAnimating = false;
                }, 800);
            }, 1000);

        } else if (isCurrentLight && !isTargetLight) {
            // Light → Dark: light screen sinks DOWN, road rises UP from below
            isAnimating = true;

            // Sink the current light screen down
            if (current) {
                current.style.transition = 'opacity 0.5s ease, transform 0.7s cubic-bezier(0.4, 0, 1, 1)';
                current.style.opacity = '0';
                current.style.transform = 'translateY(-60px)';
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
            target.classList.add('active');
            if (isTargetLight) {
                bg.classList.add('hidden');
                bg.classList.add('zoom-in');
            } else {
                bg.classList.remove('hidden');
                bg.classList.remove('zoom-in');
            }
            
            // Mobile: slide road down when entering menu
            if (window.innerWidth <= 768 && targetId === 'screen-menu') {
                bg.classList.add('slide-down');
            } else {
                bg.classList.remove('slide-down');
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
