"""Functional browser checks. Start npm start, then run this file with Playwright installed."""
import json
import os
from playwright.sync_api import sync_playwright

BASE = os.environ.get('GAME_URL', 'http://127.0.0.1:3000')
CAREER = 'rtu.career.v1'
BOUT = 'rtu.bout.v1'


def saved(page):
    return page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', CAREER)


def click(page, action):
    page.locator(f'[data-action="{action}"]').first.click()


def go(page, screen):
    page.locator(f'[data-screen="{screen}"]').first.click()


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.clock.install()
    page.goto(BASE, wait_until='networkidle')
    page.locator('[name="firstName"]').fill('Camille')
    page.locator('[name="lastName"]').fill('Durand')
    page.locator('[name="face"]').select_option('Rond')
    page.locator('[name="hair"]').select_option('Crête')
    page.locator('[name="build"]').select_option('Massif')
    page.locator('[name="weight"]').fill('95')
    assert page.locator('[name="category"]').input_value() == 'Poids lourds'
    page.get_by_role('button', name='Commencer ma carrière').click()
    first = saved(page)
    assert first['profile']['firstName'] == 'Camille'
    assert first['profile']['face'] == 'Rond'
    assert first['profile']['category'] == 'Poids lourds'
    assert len(first['attributes']) == 12
    print('PASS creation, customization, weight category, initial autosave')

    # Complete the timing game using the actual keyboard input and simulation clock.
    go(page, 'gym')
    page.locator('[data-training="bag"]').click()
    for i in range(10):
        for _ in range(250):
            position = page.locator('#training-cursor').evaluate('(el) => parseFloat(el.style.left) || 0')
            if 66 <= position <= 75:
                break
            page.clock.run_for(16)
        page.keyboard.press(['j', 'k', 'l', 'i'][i % 4])
        page.clock.run_for(240)
    assert page.locator('#modal-title').inner_text() == 'LE TRAVAIL PAIE.'
    after_training = saved(page)
    assert after_training['day'] == 2
    assert after_training['energy'] == 74
    assert after_training['attributes']['power'] > first['attributes']['power'] + 1
    click(page, 'close-modal')
    page.reload(wait_until='networkidle')
    assert saved(page) == after_training
    print('PASS interactive training, gains, energy, day progression, reload persistence')

    click(page, 'help')
    page.keyboard.press('Escape')
    assert page.locator('#modal-root').inner_html() == ''

    go(page, 'fights')
    click(page, 'book')
    fight_day = saved(page)['scheduledFight']['day']
    go(page, 'gym')
    click(page, 'rest-three')
    assert saved(page)['day'] == fight_day
    go(page, 'fights')
    click(page, 'start-fight')
    page.keyboard.down('d')
    page.keyboard.down('j')
    page.clock.run_for(900)
    page.keyboard.up('d')
    page.clock.run_for(2500)
    page.keyboard.up('j')
    page.keyboard.press('Escape')
    assert page.locator('#ring-overlay').is_visible()
    before = page.locator('#round-time').inner_text()
    page.clock.run_for(2000)
    assert page.locator('#round-time').inner_text() == before
    checkpoint = page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', BOUT)
    assert checkpoint['fight']['bout']['player']['thrown'] > 0
    assert checkpoint['fight']['bout']['player']['landed'] > 0
    page.reload(wait_until='networkidle')
    assert page.locator('#ring-overlay').is_visible()
    assert page.locator('#round-time').inner_text() == before
    print('PASS booking, calendar deadline, real punch hits, pause, combat checkpoint resume')

    # Finish through the live simulation (not through the abandon button).
    click(page, 'pause')
    page.keyboard.down('k')
    for _ in range(50):
        page.clock.run_for(5000)
        if page.locator('#modal-title').count():
            break
    page.keyboard.up('k')
    assert page.locator('#modal-title').inner_text() in ['VICTOIRE.', 'DÉFAITE.', 'MATCH NUL.']
    finished = saved(page)
    assert sum(finished['record'][k] for k in ['wins', 'losses', 'draws']) == 1
    assert len(finished['history']) == 1 and finished['scheduledFight'] is None
    assert finished['money'] > first['money']
    assert page.evaluate('(key) => localStorage.getItem(key)', BOUT) is None
    click(page, 'finish-bout')
    print('PASS complete live bout, official result, purse, record, checkpoint cleanup')

    # Sparring has its own real fight and improves skills without adding a pro result.
    go(page, 'gym')
    click(page, 'rest-three')
    page.locator('[data-training="sparring"]').click()
    page.clock.run_for(1500)
    click(page, 'forfeit')
    click(page, 'confirm-forfeit')
    sparred = saved(page)
    assert sparred['record'] == finished['record']
    assert sparred['trainingLog'][0]['id'] == 'sparring'
    assert sparred['attributes']['defense'] > finished['attributes']['defense']
    click(page, 'finish-bout')
    print('PASS interactive sparring, skill gains, professional record unchanged')

    go(page, 'profile')
    with page.expect_download() as info:
        click(page, 'export')
    download = info.value
    assert json.load(open(download.path())) == sparred
    page.locator('#import-file').set_input_files({'name': 'bad.json', 'mimeType': 'application/json', 'buffer': b'{"version":1}'})
    assert saved(page) == sparred
    assert 'valide' in page.locator('#toast').inner_text()
    page.locator('#import-file').set_input_files({'name': 'save.json', 'mimeType': 'application/json', 'buffer': json.dumps(first).encode()})
    click(page, 'confirm-import')
    assert saved(page) == first
    go(page, 'rankings')
    assert page.locator('.rank-table tbody tr').count() == 51
    assert page.locator('.player-row').count() == 1
    print('PASS save export, invalid import rejected, confirmed valid import, 51 ranking entries')

    # Alternate activities use genuinely different input patterns, including hold/release.
    for activity in ['shadow', 'rope', 'run', 'strength']:
        go(page, 'gym')
        if saved(page)['energy'] < 35:
            click(page, 'rest-three')
        page.locator(f'[data-training="{activity}"]').click()
        if activity == 'strength':
            page.keyboard.down('Space')
            page.clock.run_for(1000)
            page.keyboard.up('Space')
            assert page.locator('#training-reps').inner_text() == '1'
        else:
            page.clock.run_for(550)
            page.keyboard.press({'shadow': 'ArrowLeft', 'rope': 'Space', 'run': 'q'}[activity])
            assert page.locator('#training-reps').inner_text() == '1'
        page.clock.run_for(21000)
        assert saved(page)['trainingLog'][0]['id'] == activity
        click(page, 'close-modal')
    print('PASS shadow, rope, running, strength input and session completion')

    assert not errors, errors
    context.close()

    mobile = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=1)
    mp = mobile.new_page()
    mp.on('pageerror', lambda e: errors.append(str(e)))
    mp.clock.install()
    mp.goto(BASE, wait_until='networkidle')
    assert not mp.evaluate('document.documentElement.scrollWidth > innerWidth')
    mp.get_by_role('button', name='Commencer ma carrière').click()
    for view in ['dashboard', 'gym', 'fights', 'calendar', 'rankings', 'profile']:
        go(mp, view)
        assert not mp.evaluate('document.documentElement.scrollWidth > innerWidth'), view
    go(mp, 'fights')
    click(mp, 'book')
    go(mp, 'gym')
    click(mp, 'rest-three')
    go(mp, 'fights')
    click(mp, 'start-fight')
    button = mp.locator('[data-control="jab"]')
    assert mp.locator('.touch-controls').bounding_box()['y'] + mp.locator('.touch-controls').bounding_box()['height'] <= 844
    button.scroll_into_view_if_needed()
    box = button.bounding_box()
    mp.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    mp.mouse.down()
    mp.clock.run_for(500)
    mp.mouse.up()
    mp.clock.run_for(1800)
    mobile_bout = mp.evaluate('(key) => JSON.parse(localStorage.getItem(key))', BOUT)
    assert mobile_bout['fight']['bout']['player']['thrown'] > 0
    assert not mp.evaluate('document.documentElement.scrollWidth > innerWidth')
    mp.screenshot(path='/tmp/road-to-undisputed-mobile.png', full_page=True)
    assert not errors, errors
    print('PASS mobile layouts, on-screen punch controls, zero browser errors')
    mobile.close()
    browser.close()
    print('All browser scenarios passed.')
