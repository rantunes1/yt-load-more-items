(function () {
    'use strict';
    
    var maxItemCount = 5000;
    var PULSE_CLASS = 'more-items-pulse';

    var _interval = null;
    var _url = null;
    var _lastItemCount = 0;
    var _retries = 0;
    var _period = 1500;
   
    var replaceTextContent = function($elem, text){
        if(!$elem){
            return;
        }
        $elem.childNodes.forEach(function($node){
            $node.parentNode.removeChild($node)
        });
        if(text){
            var $text = window.document.createTextNode(text);
            $elem.appendChild($text);        
        }
    }
    
    var getItemsContainer = function(){
        var $container = window.document.querySelector('#content');
        if(!$container){
            //if logged out on the new material interface the id changes to  'contents' (plural). I'll assume this is a bug on YT.
            $container = window.document.querySelector('#contents');
        }
        return $container;
    };

    //automatically expands video description's
    var expandShowMoreButtons = function(){
        var $container = getItemsContainer();
        if(!$container){
            return;
        }
        
        $container.querySelectorAll('.yt-uix-expander-head').forEach(function($expander){
            if(!$expander.classList.contains('hidden-expander') && $expander.parentNode && $expander.parentNode.classList.contains('yt-uix-expander-collapsed')){
                $expander.click();
            }
        });
    };

    var countPageItems = function () {
        var $container = getItemsContainer();
        
        if(!$container){
            return 0;
        }
        
        var commentsCount = $container.querySelectorAll('.comment-renderer').length;
        if(commentsCount > 0){
            return commentsCount;
        }
        
        var itemSelectors = ['.yt-lockup-video', '.contains-action-menu a', '.yt-lockup-content a', '.pl-video'];
        var count = Math.min(...itemSelectors.map(function (selector) {
            console.log(selector, $container.querySelectorAll(selector).length);
            return $container ? $container.querySelectorAll(selector).length : 0;
        }).filter(function (value) {
            return value > 0;
        }));
        return (Number.isFinite(count) && !Number.isNaN(count)) ? count : 0;
    };

    var updatePageCounter = function () {
        var $counter = window.document.querySelector('#loaded-page-items-counter');
        if ($counter) {
            var itemCount = countPageItems();
            $counter.style.display = itemCount ? 'initial' : 'none';
            $counter.childNodes.forEach(function($node){
                $node.parentNode.removeChild($node)
            });
            replaceTextContent($counter, itemCount);
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
                
                var exit = function(reason){
                    if(reason){
                        console.info(reason);
                    }
                    window.clearInterval(_interval);
                    _interval = null;
                    resolve();
                    return false;
                }

                var itemCount = updatePageCounter();
                if(itemCount === _lastItemCount){
                    _retries ++;
                    if(_retries > 3){
                        _lastItemCount = 0;
                        _retries = 0;
                        $button.style.display = 'none';
                        exit('button exists but there\'s no more items to load. stopping items loader.');
                    }
                }else{
                    _retries = 0;
                }
                _lastItemCount = itemCount;

                var wasItemCountExceeded = itemCount && maxItemCount ? itemCount >= maxItemCount : false;

                if (!$button || wasItemCountExceeded) {
                    exit('stopping items loader');
                }

                if ($loadMoreTriggerButton && loadingClass && !$loadMoreTriggerButton.classList.contains(loadingClass)) {
                    exit('cancelling items loader');
                }

                if ($button.hasAttribute('disabled') || $button.classList.contains('yt-uix-load-more-loading')) {
                    return false;
                }

                $button.removeAttribute('data-scrolldetect-offset');
                $button.removeAttribute('data-scrolldetect-callback');
                $button.click();
                
                expandShowMoreButtons();
            }, _period);
        });
    };

    window.setInterval(function () {
        if (window.location.href !== _url) {
            _url = window.location.href;
            window.setTimeout(function () {
                updatePageCounter();
                expandShowMoreButtons();
                window.scrollTo(0,0);
            }, 1400);
        } else {
            var $commentsContainer = window.document.querySelector('.comment-section-renderer-items');
            if ($commentsContainer && !$commentsContainer.classList.contains('processed')) {
                $commentsContainer.classList.add('processed');
                updatePageCounter();
            }
        }
    }, _period);
    
    window.setTimeout(function () {
        expandShowMoreButtons();
        window.scrollTo(0,0);
    }, _period);

    var $uploadBtn = window.document.querySelector('#upload-button, #upload-btn'); //@todo 'upload_btn' was used on previous interface. remove selector once new ui is rolled out globally
    if ($uploadBtn) {
        var loadMoreLabel = 'Load More'; //@todo i18n
        var $loadMoreBtn = $uploadBtn.cloneNode(true);
        $loadMoreBtn.setAttribute('id', 'more-items-trigger');
        var $content = $loadMoreBtn.querySelector('.yt-uix-button-content');
        if ($content) {
            $content.childNodes.forEach(function($node){
                $node.parentNode.removeChild($node)
            });
            replaceTextContent($content, loadMoreLabel);
        }
        if ($loadMoreBtn.hasAttribute('title')) {
            $loadMoreBtn.setAttribute('title', loadMoreLabel);
        }
        if ($loadMoreBtn.hasAttribute('href')) {
            $loadMoreBtn.setAttribute('href', '#');
        }
        
        var $counter = window.document.createElement('span');
        $counter.setAttribute('id', 'loaded-page-items-counter');
        
        $loadMoreBtn.style.position = 'relative';
        $loadMoreBtn.appendChild($counter);

        var $icon = $loadMoreBtn.querySelector('.yt-uix-button-icon');
        if ($icon) {
            $icon.classList.add('more-items-icon');
            $counter.classList.add('more-items-icon');
            $loadMoreBtn.classList.add('more-items-button');            
        } else if ($content) {
            $content.classList.add('more-items-button');
            $counter.classList.add('more-items-button');
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