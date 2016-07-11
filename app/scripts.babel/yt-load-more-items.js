(function () {
    'use strict';
    
    var maxItemCount = 5000;
    var PULSE_CLASS = 'more-items-pulse';

    var _interval = null;
    var _url = null;

    var countPageItems = function () {
        var itemSelectors = ['.yt-lockup-video', '.contains-action-menu a', '.yt-lockup-content a', '.pl-video', '.comment-renderer'];

        var count = Math.min(...itemSelectors.map(function (selector) {
            var $container = window.document.querySelector('#content');
            if(!$container){
                //if logged out on the new material interface the id changes to  'contents' (plural). I'll assume this is a bug on YT.
                $container = window.document.querySelector('#contents');
            }
           
            return $container ? $container.querySelectorAll(selector).length : 0;
        }).filter(function (value) {
            return value > 0;
        }));
        return (Number.isFinite(count) && !Number.isNaN(count)) ? count : 0;
    };

    var updatePageCounter = function () {
        var $counter = document.querySelector('#loaded-page-items-counter');
        if ($counter) {
            var itemCount = countPageItems();
            $counter.style.display = itemCount ? 'initial' : 'none';
            $counter.innerHTML = itemCount;
            return itemCount;
        }
        return 0;
    };

    var load = function ($loadMoreTriggerButton, loadingClass) {
        return new window.Promise(function (resolve) {
            if (_interval) {
                window.clearInterval(_interval);
                _interval = null;
            }

            _interval = window.setInterval(function () {
                var $button = window.document.querySelector('.load-more-button');

                var itemCount = updatePageCounter();

                var wasItemCountExceeded = itemCount && maxItemCount ? itemCount >= maxItemCount : false;

                if (!$button || wasItemCountExceeded) {
                    console.info('stopping items loader');
                    window.clearInterval(_interval);
                    _interval = null;
                    resolve();
                    return false;
                }

                if ($loadMoreTriggerButton && loadingClass && !$loadMoreTriggerButton.classList.contains(loadingClass)) {
                    console.info('cancelling items loader');
                    window.clearInterval(_interval);
                    _interval = null;
                    resolve();
                    return false;
                }

                if ($button.hasAttribute('disabled') || $button.classList.contains('yt-uix-load-more-loading')) {
                    return false;
                }

                $button.removeAttribute('data-scrolldetect-offset');
                $button.removeAttribute('data-scrolldetect-callback');
                $button.click();
            }, 1500);
        });
    };

    window.setInterval(function () {
        if (window.location.href !== _url) {
            _url = window.location.href;
            window.setTimeout(function () {
                updatePageCounter();
            }, 1400);
        } else {
            var $commentsContainer = window.document.querySelector('.comment-section-renderer-items');
            if ($commentsContainer && !$commentsContainer.classList.contains('processed')) {
                $commentsContainer.classList.add('processed');
                updatePageCounter();
            }
        }
    }, 1500);

    var $uploadBtn = window.document.querySelector('#upload-button, #upload-btn'); //@todo 'upload_btn' was used on previous interface. remove selector once new ui is rolled out globally
    if ($uploadBtn) {
        var loadMoreLabel = 'Load Items'; //@todo i18n
        var $loadMoreBtn = $uploadBtn.cloneNode(true);
        $loadMoreBtn.setAttribute('id', 'more-items-button');
        var $content = $loadMoreBtn.querySelector('.yt-uix-button-content');
        if ($content) {
            $content.innerHTML = loadMoreLabel;
        }
        if ($loadMoreBtn.hasAttribute('title')) {
            $loadMoreBtn.setAttribute('title', loadMoreLabel);
        }
        if ($loadMoreBtn.hasAttribute('href')) {
            $loadMoreBtn.setAttribute('href', '#');
        }
        $loadMoreBtn.style.position = 'relative';
        var $counter = window.document.createElement('span');
        $counter.setAttribute('id', 'loaded-page-items-counter');
        $loadMoreBtn.appendChild($counter);

        var $icon = $loadMoreBtn.querySelector('.yt-uix-button-icon');
        if ($icon) {
            $icon.classList.add('more-items-button');
        } else if ($content) {
            $content.classList.add('more-items-button');
        }
            

        $loadMoreBtn.onclick = function (event) {
            event.stopPropagation();
            event.preventDefault();

            var loadingClass = 'loading-all-items';
            if ($loadMoreBtn.classList.contains(loadingClass)) {
                $loadMoreBtn.classList.remove(loadingClass);
                if ($icon) {
                    $icon.classList.remove(PULSE_CLASS);
                } else if ($content) {
                    $content.classList.remove(PULSE_CLASS);
                }
                return false;
            } else {
                $loadMoreBtn.classList.add(loadingClass);
                if ($icon) {
                    $icon.classList.add(PULSE_CLASS);
                } else if ($content) {
                    $content.classList.add(PULSE_CLASS);
                }
            }

            load($loadMoreBtn, loadingClass, $counter).then(function () {
                if ($icon) {
                    $icon.classList.remove(PULSE_CLASS);
                } else if ($content) {
                    $content.classList.remove(PULSE_CLASS);
                }
                $loadMoreBtn.classList.remove(loadingClass);
            });

            return false;
        };
        $uploadBtn.parentNode.insertBefore($loadMoreBtn, $uploadBtn);
        updatePageCounter();
    }
}());