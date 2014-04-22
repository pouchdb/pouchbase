
(function() {

  var content = document.getElementById('content');

  function hashChanged() {
    var hash = document.location.hash.slice(1) || 'home';
    var contents = document.getElementById('page-' + hash);
    if (!contents) {
      return content.innerHTML = 'You gone and screwed up';
    }
    content.innerHTML = '<div id="' + hash + '">' + contents.innerHTML + '</div>';
  }

  window.addEventListener('hashchange', hashChanged);
  hashChanged();

})();

var janus = new Janus('developer');

document.getElementById('persona').addEventListener('click', function() {
  janus.login();
});
