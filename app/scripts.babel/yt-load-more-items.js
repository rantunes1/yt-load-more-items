(function () {
    'use strict';

    var MAX_ITEM_COUNT = 5555;
    var LOG_ID = '[yt-load-more-items-extension] ';
    var PULSE_CLASS = 'more-items-pulse';
    var DISABLED_CLASS = 'more-items-disabled';
    var ICON_CLASS = 'more-items-icon';
    var BUTTON_CLASS = 'more-items-button';
    var LOAD_MORE_SELECTOR = '.load-more-button, .compact-shelf-view-all-card-link';
    var LOAD_MORE_ICON_SELECTOR = '.yt-uix-button-icon';
    var LOAD_MORE_ITEMS_ID = 'more-items-trigger';

    var LOAD_MORE_LABEL = 'Load More'; //@todo i18n
    var ALL_LOADED_LABEL = 'All Loaded'; //@todo i18n

    var _interval = null;
    var _url = null;
    var _lastItemCount = 0;
    var _retries = 0;
    var _period = 600;
    var _loading = null;
    var _user_scrolled = false;

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
    };

    var changesDetector = function (changeSelector, doOnChangeFn) {
        return function (changes) {
            changes.forEach(function (change) {
                var $addedCol = change.addedNodes;
                if (!$addedCol.length && change.type === 'attributes') {
                    $addedCol = [change.target];
                }
                $addedCol.forEach(function ($added) {
                    if ($added.nodeType === window.Node.ELEMENT_NODE) {
                        var $elem = $added.querySelector(changeSelector);
                        if ($elem) {
                            //match node's children
                            try{
                                doOnChangeFn($elem, $added);
                            }catch(error){
                                console.error(LOG_ID, 'error notifying children change on node', doOnChangeFn, $elem, $added, error);
                            }
                        } else {
                            var $parent = $added.parentNode;
                            if ($parent) {
                                var $parentMatch = $added.parentNode.querySelector(changeSelector);
                                if ($parentMatch && $parentMatch.isSameNode($added)) {
                                    //match on node
                                    try{
                                        doOnChangeFn($added, $added);
                                    }catch(error){
                                        console.error(LOG_ID, 'error notifying change on node', doOnChangeFn, $added, error);
                                    }
                                }
                            }
                        }
                    }
                });
            });
        };
    };

    var getItemsContainer = function(){
        var $container = window.document.querySelector('#content');
        if(!$container){
            //if logged out on the new material interface the id changes to  'contents' (plural). I'll assume this is a bug on YT.
            $container = window.document.querySelector('#contents');
        }
        return $container;
    };

    var expandVideoDescription = function(){
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

        var itemSelectors = ['.yt-lockup-video', '.contains-action-menu a', '.yt-lockup-content a', '.pl-video', '.subscription-item'];
        var count = Math.min(...itemSelectors.map(function (selector) {
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
    
    var getNextLoadMoreButton = function(){
        return window.document.querySelector(LOAD_MORE_SELECTOR);
    };
    
    var disableLoadMoreButton = function($loadMoreButton){
        //disable the button
        $loadMoreButton.setAttribute('disabled', 'disabled');
        var $icon = $loadMoreButton.querySelector(LOAD_MORE_ICON_SELECTOR);
        if($icon){
            $icon.classList.add(DISABLED_CLASS);
        }
        var updatedText = false;
        
        if ($loadMoreButton.hasAttribute('title')) {
            $loadMoreButton.setAttribute('title', ALL_LOADED_LABEL);
            updatedText = true;
        }
        
        if ($loadMoreButton.hasAttribute('data-tooltip-text')) {
            $loadMoreButton.setAttribute('data-tooltip-text', ALL_LOADED_LABEL);
            $loadMoreButton.setAttribute('data-position', 'topright');
            updatedText = true;
        }
        
        if(!updatedText){
            replaceTextContent($loadMoreButton, ALL_LOADED_LABEL);
        }
        
        //@todo replace icon with sorting component        
    };    
    
    var initLoadMoreButton = function(){
        if(!$uploadBtn){
            return; //new YT layout
        }
        var $body = document.querySelector('body');
        if($body && !$body.classList.contains('scrolldetect')){
            $body.setAttribute('data-scrolldetect-callback','comments-delay-load');
            $body.classList.add('scrolldetect');
        }
        
        var $loadMoreBtn = $uploadBtn.cloneNode(true);
        $loadMoreBtn.setAttribute('id', LOAD_MORE_ITEMS_ID);
        var $content = $loadMoreBtn.querySelector('.yt-uix-button-content');
        if ($content) {
            $content.childNodes.forEach(function($node){
                $node.parentNode.removeChild($node)
            });
            replaceTextContent($content, LOAD_MORE_LABEL);
        }
        if ($loadMoreBtn.hasAttribute('title')) {
            $loadMoreBtn.setAttribute('title', LOAD_MORE_LABEL);
        }
        if ($loadMoreBtn.hasAttribute('href')) {
            $loadMoreBtn.setAttribute('href', '#');
        }

        var $counter = window.document.createElement('span');
        $counter.setAttribute('id', 'loaded-page-items-counter');

        $loadMoreBtn.appendChild($counter);

        var $icon = $loadMoreBtn.querySelector(LOAD_MORE_ICON_SELECTOR);
        if ($icon) {
            $icon.classList.add(ICON_CLASS);
            $counter.classList.add(ICON_CLASS);
            $loadMoreBtn.classList.add(BUTTON_CLASS);
        } else if ($content) {
            $content.classList.add(BUTTON_CLASS);
            $counter.classList.add(BUTTON_CLASS);
        }

        var $button = getNextLoadMoreButton();
        if(!$button){
            disableLoadMoreButton($loadMoreBtn);
        }else{
            $loadMoreBtn.addEventListener('click', function (event) {
                event.stopPropagation();
                event.preventDefault();

                if($loadMoreBtn.getAttribute('disabled')){
                    return false;
                }

                var loadingClass = 'loading-all-items';
                if ($loadMoreBtn.classList.contains(loadingClass)) {
                    $loadMoreBtn.classList.remove(loadingClass);
                    if ($icon) {
                        $icon.classList.remove(PULSE_CLASS);
                    } else {
                        $loadMoreBtn.classList.remove(PULSE_CLASS);
                    }
                    return false;
                } else {
                    $loadMoreBtn.classList.add(loadingClass);
                    if ($icon) {
                        $icon.classList.add(PULSE_CLASS);
                    } else {
                        $loadMoreBtn.classList.add(PULSE_CLASS);
                    }
                }

                _loading = load($loadMoreBtn, loadingClass).then(function () {
                    if ($icon) {
                        $icon.classList.remove(PULSE_CLASS);
                    } else {
                        $loadMoreBtn.classList.remove(PULSE_CLASS);
                    }
                    $loadMoreBtn.classList.remove(loadingClass);
                    _loading = null;
                });

                return false;
            });        
        }
        
        $uploadBtn.parentNode.insertBefore($loadMoreBtn, $uploadBtn);
    };            

    var load = function ($loadMoreButton, loadingClass) {
        if(_loading){
            return _loading;
        }
        return new window.Promise(function (resolve) {
            var exit = function(reason, disableButton){
                if(reason){
                    console.info(LOG_ID, reason);
                }
                window.clearInterval(_interval);
                _interval = null;
                if(disableButton === true){
                    disableLoadMoreButton($loadMoreButton);
                }
                resolve();
                return false;
            };

            if (_interval) {
                window.clearInterval(_interval);
                _interval = null;
            }
            _interval = window.setInterval(function () {
                var $button = getNextLoadMoreButton();

                var itemCount = updatePageCounter();
                if(itemCount === _lastItemCount){
                    _retries ++;
                    if(_retries > 100){
                        _lastItemCount = 0;
                        _retries = 0;
                        $button.style.display = 'none';
                        exit('button exists but there\'s no more items to load. stopping items loader.', true);
                    }
                }else{
                    _retries = 0;
                }
                _lastItemCount = itemCount;

                var wasItemCountExceeded = itemCount && itemCount >= MAX_ITEM_COUNT;

                if (!$button || wasItemCountExceeded) {
                    exit('stopping items loader', true);
                }

                if ($loadMoreButton && loadingClass && !$loadMoreButton.classList.contains(loadingClass)) {
                    exit('cancelling items loader');
                }

                if (!$button || $button.hasAttribute('disabled') || $button.classList.contains('yt-uix-load-more-loading')) {
                    return false;
                }

                $button.removeAttribute('data-scrolldetect-offset');
                $button.removeAttribute('data-scrolldetect-callback');                
                $button.click();

                expandVideoDescription();
            }, _period);
        });
    };

    window.document.addEventListener('scroll', function(){
        _user_scrolled = true;
        return true;
    });
    window.setInterval(function () {
        var $loadMoreTriggerButton = window.document.querySelector('#' + LOAD_MORE_ITEMS_ID);
        if (window.location.href !== _url) {            
            if (_url && $loadMoreTriggerButton) {
                $loadMoreTriggerButton.parentNode.removeChild($loadMoreTriggerButton);                
                _user_scrolled = false;
            }
            _url = window.location.href;
            window.setTimeout(function () {
                initLoadMoreButton();
                updatePageCounter();
                expandVideoDescription();
                if(!_user_scrolled){
                    window.scrollTo(0, 0);
                }
            }, _period);
        } else {
            var $commentsContainer = window.document.querySelector('.comment-section-renderer-items');
            if ($commentsContainer && !$commentsContainer.classList.contains('processed')) {
                $commentsContainer.classList.add('processed');
                if($loadMoreTriggerButton){
                    $loadMoreTriggerButton.parentNode.removeChild($loadMoreTriggerButton);                
                }
                _user_scrolled = false;
                initLoadMoreButton();
                updatePageCounter();
            }
        }
    }, _period);

    window.setTimeout(expandVideoDescription, _period);

    var $uploadBtn = window.document.querySelector('#upload-button, #upload-btn');
    //@todo 'upload_btn' was used on previous interface. remove selector once new ui is rolled out globally
    //@todo on latest layout selector should be "ytd-button-renderer" but as now yt has continuous scroll there's no point in adding this
    //to the extension

    if (!$uploadBtn) {
        return false;
    }

    if(window.document.querySelector('#' + LOAD_MORE_ITEMS_ID)){
        return false;
    }

    var dialogChangeDetector = changesDetector(LOAD_MORE_SELECTOR, function($button){
        if(!$button || $button.classList.contains('yt-load-more') || $button.classList.contains('comment-replies-renderer-expander-down')){
            return;
        }
        var eventListener = function(event){
            event.stopPropagation();
            event.preventDefault();
            $button.removeEventListener('click', eventListener);
            if(!_loading){
                var $loadMoreBtn = window.document.querySelector('#' + LOAD_MORE_ITEMS_ID);
                if($loadMoreBtn){
                    $loadMoreBtn.click();
                }
            }
            return false;
        }
        //remove auto load on scroll
        $button.classList.remove('scrolldetect');
        $button.classList.add('yt-load-more');
        $button.addEventListener('click', eventListener);
    });
    var $body = window.document.querySelector('body');

    new window.MutationObserver(dialogChangeDetector).observe($body, { attributes: true, subtree: true });    
}());