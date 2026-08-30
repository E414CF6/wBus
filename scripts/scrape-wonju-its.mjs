import {existsSync, mkdirSync, writeFileSync} from 'fs';
import {dirname, join} from 'path';

const BASE_URL = 'http://its.wonju.go.kr';
const LIST_URL = `${BASE_URL}/bus/bus04.do`;
const DETAIL_URL = `${BASE_URL}/bus/bus04Detail.do`;
const PRIMARY_CACHE_PATH = join(process.cwd(), 'public', 'data', 'scheduleCache.json');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
};

const TARGET_RAW_NOS = ['30', '34(평일)', '34(방학,휴일)', '34-1(평일)', '34-1(방학,휴일)'];

async function fetchList(onlyYonsei = false) {
    console.log('Fetching route list from Wonju ITS...');
    const res = await fetch(LIST_URL, {headers: HEADERS, signal: AbortSignal.timeout(8000)});
    const html = await res.text();

    // Extract CSRF token
    const csrfMatch = html.match(/name=["']CSRFToken["']\s+value=["']([^"']+)["']/);
    const csrfToken = csrfMatch ? csrfMatch[1] : '';

    // Extract cookies if any set
    const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const cookieStr = rawCookies.map(c => c.split(';')[0]).join('; ');

    // Match table rows
    const rowRegex = /<tr[^>]*>\s*<td[^>]*onclick=["']goDetail\(['"]([^'"]+)['"]\);["'][^>]*>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<\/tr>/gs;

    const routes = [];
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
        const detailId = match[1].trim();
        const rawNo = match[2].replace(/<[^>]+>/g, '').trim();

        if (onlyYonsei) {
            const isTarget = TARGET_RAW_NOS.includes(rawNo) || rawNo.startsWith('30') || rawNo.startsWith('34');
            if (!isTarget) continue;
        }

        const cleanStationName = (name) => name ? name.replace(/장양리시내버스공영(정류장)?/g, '장양리') : name;
        const origin = cleanStationName(match[3].replace(/<[^>]+>/g, '').trim());
        const destination = cleanStationName(match[4].replace(/<[^>]+>/g, '').trim());
        const firstBus = match[5].replace(/<[^>]+>/g, '').trim();
        const lastBus = match[6].replace(/<[^>]+>/g, '').trim();
        const runCount = match[7].replace(/<[^>]+>/g, '').trim();
        const interval = match[8].replace(/<[^>]+>/g, '').trim();

        let routeNo = rawNo;
        let dayType = '매일';
        const parenMatch = rawNo.match(/^([^(]+)(?:\(([^)]+)\))?/);
        if (parenMatch) {
            routeNo = parenMatch[1].trim();
            if (parenMatch[2]) {
                dayType = parenMatch[2].trim();
            }
        }

        routes.push({
            id: detailId,
            rawNo,
            routeNo,
            dayType,
            origin,
            destination,
            firstBus,
            lastBus,
            runCount,
            interval,
            timetable: []
        });
    }

    return {csrfToken, cookieStr, routes};
}

async function fetchDetail(detailId, csrfToken, cookieStr) {
    const formData = new URLSearchParams();
    formData.append('CSRFToken', csrfToken);
    formData.append('no', detailId);

    const reqHeaders = {
        ...HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': LIST_URL,
        'Origin': BASE_URL,
        'Cookie': cookieStr,
        'X-CSRF-TOKEN': csrfToken
    };

    const res = await fetch(DETAIL_URL, {
        method: 'POST', headers: reqHeaders, body: formData.toString(), signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch detail for ${detailId} (Status: ${res.status})`);
    }

    const html = await res.text();

    const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) return [];

    const tbodyHtml = tbodyMatch[1];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const timetable = [];

    let trMatch;
    while ((trMatch = trRegex.exec(tbodyHtml)) !== null) {
        const trContent = trMatch[1];
        const tdMatches = [...trContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());

        if (tdMatches.length >= 4) {
            const seq = parseInt(tdMatches[0], 10) || timetable.length + 1;
            const originDepTime = tdMatches[1] || '-';
            const destDepTime = tdMatches[2] || '-';
            const type = tdMatches[3] || '공통';
            const notes = tdMatches[4] || '';

            timetable.push({seq, originDepTime, destDepTime, type, notes});
        }
    }

    return timetable;
}

async function runScraper(options = {onlyYonsei: false}) {
    const startTime = Date.now();
    console.log('--- Wonju ITS Bus Timetable Scraper Started ---');

    const {csrfToken, cookieStr, routes} = await fetchList(options.onlyYonsei);
    console.log(`Found ${routes.length} routes. Crawling timetable details...`);

    const BATCH_SIZE = 8;
    for (let i = 0; i < routes.length; i += BATCH_SIZE) {
        const batch = routes.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (route) => {
            try {
                route.timetable = await fetchDetail(route.id, csrfToken, cookieStr);
            } catch (err) {
                console.error(`Failed to fetch detail for ${route.id}:`, err.message);
                route.timetable = [];
            }
        }));
        process.stdout.write(`Progress: ${Math.min(i + BATCH_SIZE, routes.length)} / ${routes.length}\r`);
    }

    console.log('\nAll details fetched.');

    const cacheData = {
        updatedAt: new Date().toISOString(), sourceUrl: LIST_URL, totalRoutes: routes.length, routes
    };

    const jsonStr = JSON.stringify(cacheData, null, 2);

    const targetPaths = [join(process.cwd(), '.cache', 'scheduleCache.json'), join(process.cwd(), '.cache', 'cache.json'), PRIMARY_CACHE_PATH, '/tmp/scheduleCache.json', '/tmp/cache.json'];

    for (const targetPath of targetPaths) {
        try {
            const dir = dirname(targetPath);
            if (!existsSync(dir)) {
                mkdirSync(dir, {recursive: true});
            }
            writeFileSync(targetPath, jsonStr, 'utf-8');
            console.log(`Saved file cache to: ${targetPath}`);
        } catch (e) {
            // Ignore write errors for read-only environments
        }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Total routes: ${routes.length}, Elapsed time: ${elapsed}s`);
    return cacheData;
}

if (process.argv[1] && (process.argv[1].endsWith('scrape-wonju-its.mjs') || process.argv[1].endsWith('scrape-wonju-its.js') || process.argv[1].includes('scrape-wonju-its'))) {
    const onlyYonsei = process.argv.includes('--yonsei');
    runScraper({onlyYonsei}).catch(err => {
        console.error('Fatal error during scraping:', err);
        process.exit(1);
    });
}

export {runScraper, PRIMARY_CACHE_PATH as CACHE_PATH};
export default {runScraper, CACHE_PATH: PRIMARY_CACHE_PATH};
