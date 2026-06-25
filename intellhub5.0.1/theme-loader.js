(function () {
    const theme = localStorage.getItem('selectedTheme');
    if (theme) {
        const link = document.getElementById('theme-stylesheet');
        if (link) {
            link.href = theme;
        }
    }
})();
