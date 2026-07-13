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
            // Zoom IN (Dark to Light)
            isAnimating = true;
            bg.classList.add('zoom-in');
            if(current) current.classList.remove('active');

            setTimeout(() => {
                target.classList.add('active');
                bg.classList.add('hidden');
                isAnimating = false;
            }, 800); // Wait for zoom to almost finish
            
        } else if (isCurrentLight && !isTargetLight) {
            // Zoom OUT (Light to Dark)
            isAnimating = true;
            if(current) current.classList.remove('active');
            
            // Show zoomed background again
            bg.classList.remove('hidden');
            
            // Force reflow so it knows it's zoomed before we remove it
            void bg.offsetWidth;
            
            bg.classList.remove('zoom-in');
            
            setTimeout(() => {
                target.classList.add('active');
                isAnimating = false;
            }, 800); // Wait for zoom out
            
        } else {
            // Normal switch
            if(current) current.classList.remove('active');
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
    transitionScreens(null, 'screen-home');
});
