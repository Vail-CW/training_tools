/* Based on code by Eric Holk, found on http://blog.theincredibleholk.org/blog/2014/06/23/generating-morse-code-with-javascript/
   and improved by Francois Wisard HB9FXW
 * June 15th 2016
 *
 * Added AudioContext-MonkeyPatch by Chris Wilson for better compatibility with browsers
 * January 6th 2017
 *
   */
var intervalVisu = 0;
// var noSleep = new NoSleep();
var lastFullQso = '';
var dromflag = 0;

var names = ['leo', 'tiphaine', 'ben', 'jim', 'mike', 'jon', 'john', 'luke', 'mark', 'markus', 'mat', 'henry', 'erik', 'eric', 'james', 'bob', 'bill', 'will', 'kurt', 'heinrich', 'hugo', 'luigi', 'mario', 'klaus', 'aron', 'gunnar', 'olaf', 'jack', 'daniel', 'dan', 'luca', 'tom', 'noah', 'emil', 'david', 'dave', 'mirko', 'andrei', 'sergey', 'valery', 'alex', 'liam', 'oskar', 'emir', 'berat', 'georges', 'paul', 'angus', 'oliver', 'jack', 'omer', 'leon', 'mihai', 'andrea', 'matteo', 'peter', 'finn', 'anton', 'kevin', 'tarik', 'frank', 'victor', 'mohammed', 'max', 'rayan', 'ivan', 'ali', 'luis', 'samuel', 'ralf', 'said', 'juan', 'jose', 'diego', 'neil', 'ethan', 'seb', 'joe', 'jo', 'peng', 'tao', 'cheng', 'wei', 'muhamad', 'fahd', 'art', 'gary', 'giorgi', 'hans', 'malik', 'vic', 'chris', 'tim', 'gandalf', 'gladys', 'rob', 'chuck', 'chus', 'niko', 'ken', 'andy', 'ian', 'dima', 'alan', 'ulf', 'herb', 'werner', 'esteban', 'ramon'];

var rigs = ['ic 7000', 'ic 7200', 'ft 101ee', 'ts 450', 'ts 520', 'ts 530sp', 'ft 450d', 'ft 991', 'ft dx1200', 'ft 897d', 'ft 1e', 'homebrew', 'ts 590s', 'ts 2000', 'ic 7851', 'ic 9100', 'ts 480', 'ft 817nd', 'pixie 2', 'kx3', 'k2', 'k1', 'tuna tin 2', 'argonaut v', 'ic 706mk2', 'tt rebel', 'mfj 9200', 'mtn topper', 'norcal 49er', 'hw 9', 'rockmite 2', 'youkits hb1b', 'youkits ek1a', 'tentec omni 5', 'tt century 21', 'mfj cub', 'mtr', 'dc20b', 'ft 102', 'ts 440', 'ts 830s', 'ft 902dm', 'ft 101zd', 'hw 101', 'hw 16', 'uw3di', 'ft dx9000', 'ic 7700', 'bitx40'];

var femNames = ['maria', 'tiphaine', 'sandra', 'alexa', 'heidi', 'adelaide', 'elisabeth', 'anna', 'hilde', 'sarah', 'carla', 'rita', 'diana', 'zelda', 'jaina', 'lucy', 'yuki', 'lea', 'marion', 'emma', 'carmen', 'abby', 'deirdre', 'phoebe', 'laetitia', 'jane', 'nikki', 'zia', 'conchita', 'rose', 'lois', 'ligia', 'fatima', 'aicha', 'amel', 'chloe', 'aglae'];

function getOrdinal() {
    var ordinal = [' i', ' ii', ' iii', ' iv', ' v', ' vi', ' vii', ' viii', ' ix', ' x', ' xi', ' xii', ' xiii', ' xiv', ' xv', ' xvi', ' 1', ' 2', ' 3', ' 4', ' 5', ' 6', ' 7', ' 8', ' 9', ' 10', ' 11', ' 12', ' 13', ' 14', ' 15', ' 16', ' the 1st', '', '', '', '', '', ''];
    return pick(ordinal);
}

function getRoyal() {
    var rTitles = ['duke ', 'king ', 'prince ', 'queen ', 'princess ', 'saint '];
    var temp = pick(rTitles);
    var tName = getName()[1];
    if (tName == 'gladys') temp = 'queen gladys ';
    switch (temp) {
        case 'duke ':
        case 'king ':
        case 'prince ':
            temp += tName + getOrdinal();
            break;
        case 'queen ':
        case 'princess ':
            temp += pick(femNames) + getOrdinal();
            break;
        case 'saint ': //no ordinal for saints
            if (Math.random() < 0.5) {
                temp += pick(femNames);
            }
            else {
                temp += tName;
            }
            break;
        default:
    }
    return temp + ' ';
}

var isUnlocked = false;
var counter = 0;
function unlock() {
	if (isUnlocked)
		return;

	// create empty buffer and play it
	var buffer = ac.createBuffer(1, 1, 22050);
	var source = ac.createBufferSource();
	source.buffer = buffer;
	source.connect(ac.destination);
    if (source.start) source.start();
    else source.noteOn(0);

	// by checking the play state after some time, we know if we're really unlocked
	setTimeout(function() {
		if ((source.playbackState === source.PLAYING_STATE || source.playbackState === source.FINISHED_STATE)) {
			isUnlocked = true;
		}
	}, 0);
}
function cut(n) {
    n=''+n;
    n= n.replace(/0/g, 't');
    n= n.replace(/9/g, 'n');
    return n;
}

function cutOrNot(n) {
    if (Math.random() > 0.2) {
        return cut(n);
    }
    else {
        return ''+n;
    }
}


function getValidGrid() {
    //only consider the first 6 chars
    //returns either null or valid grid 6 chars long
    var gridRe = /^([a-rA-R]{2}$)|([a-rA-R]{2}\d\d$)|([a-rA-R]{2}\d\d[a-xA-X]{2})/g ;
    var validGrid = gridRe.exec($('#mygrid').val()) ;
    if (! validGrid) { return null; }
    validGrid = validGrid[0]
    if (validGrid.length == 2) { validGrid += "55ll"; }
    else if (validGrid.length == 4) { validGrid += "ll"; }
    return validGrid;
}

function letterToNum(s) {
    s = s.toLowerCase();
    var x = s.charCodeAt(0);
    x -= 97;
    return x;
}

function numToLetter(n) {
    return String.fromCharCode(n + 97);
}

function gridToLL(s) {
    //requires 6 chars grid, returns lat and long
    var lat = letterToNum(s.substr(1, 1)) * 10;
    var lon = letterToNum(s.substr(0, 1)) * 20;
    lat += parseInt(s.substr(3, 1));
    lon += parseInt(s.substr(2, 1)) * 2;
    lat += letterToNum(s.substr(5, 1)) * 0.04167;
    lon += letterToNum(s.substr(4, 1)) * 0.08333;

    lat = lat - 90;
    lon = lon - 180;

    return { lat: lat, lon: lon };
}

function lLtoGrid(lat, lon) {
    // returns 6 chars
    var lonRest = lon + 180;
    var latRest = lat + 90;
    if (latRest < 0) { latRest += 180; }
    else if (latRest > 180) { latRest -= 180; }
    if (lonRest < 0) { lonRest += 360; }
    else if (lonRest > 360) { lonRest -= 360; }
    var lonTemp = Math.trunc(lonRest/20);
    var latTemp = Math.trunc(latRest/10);
    var sGrid = numToLetter(lonTemp);
    lonRest -= lonTemp * 20;
    sGrid += numToLetter(latTemp);
    latRest -= latTemp * 10;
    lonTemp = Math.trunc(lonRest / 2);
    latTemp = Math.trunc(latRest);
    sGrid += "" + lonTemp + latTemp;
    lonRest -= lonTemp * 2;
    latRest -= latTemp;
    sGrid += numToLetter(Math.trunc(lonRest * 12));
    sGrid += numToLetter(Math.trunc(latRest * 24));
    return sGrid;
}
function getGrid(l)  { // 1: HF 4chars, 2: HF 6 chars, 3: VHF 6 chars
    var mygrid = getValidGrid();
    var localonly = $('#clocal').prop('checked');
    var myLL = gridToLL("aa00aa");
    var maxDist = 500;
    var minDist = 1;

    var az;
    var dist;

    if (mygrid) {
        myLL = gridToLL(mygrid);
        if (localonly) {
            if (l < 3) { maxDist = 1500; } // HF local
            else { maxDist = 500; } // VHF local
        }
        else { //dx 
            const rnd = Math.random();
            if (l < 3) { // HF
                if (rnd < 0.5) { maxDist = 2000; }
                else if (rnd < 0.8) { minDist = 1500; maxDist = 9000; }
                else { minDist = 7000; maxDist = 19000; }
            }
            else { // VHF
                if (rnd < 0.65) { maxDist = 550; }
                else if (rnd < 0.97) { minDist = 200; maxDist = 1000; }
                else { minDist = 600; maxDist = 4170; } // 3% chance of big dx
            }
        }
    }
    else { // no grid set
        if (localonly) {
            myLL = gridToLL("en00cd") //roughly in the middle of the USA
            if (l < 3) { maxDist = 2400; } //HF
            else { maxDist = 1000; } //VHF
        }
        else { // Whole world
            maxDist = 19000;
        }
    }
    var done = false;
    var badCounter = 0;
    do {
        dist = Math.random() * maxDist + minDist;
        az = Math.random()*360; 
        ret = getDestinationPoint(myLL.lat, myLL.lon, az, dist);
        ret = lLtoGrid(ret.lat, ret.lon);
        badCounter += 1;
    }
    while (isGridBad(ret) && badCounter < 5); // avoid "bad" grids if possible
    if (l < 2) { ret = ret.substr(0,4); }
    return ret;

}

function isGridBad(grid) {
    // still a lot of water and desert
    var good = ["ap", "bp", "cp", "dp", "ep", "fp", "gp", "hp", "ip", "jp", "kp", "lp", "mp", "np", "op", "pp", "qp", "rp", "bo", "co", "do", "eo", "fo", "go", "io", "jo", "ko", "lo", "mo", "no", "oo", "po", "qo", "cn", "dn", "en", "fn", "gn", "in", "jn", "kn", "ln", "mn", "nn", "on", "pn", "qn", "cm", "dm", "em", "fm", "im", "jm", "km", "lm", "mm", "nm", "om", "pm", "qm", "bl", "dl", "el", "fl", "il", "jl", "kl", "ll", "ml", "nl", "ol", "bk", "ek", "fk", "ik", "jk", "kk", "lk", "mk", "nk", "ok", "pk", "fj", "gj", "ij", "jj", "kj", "lj", "mj", "nj", "oj", "pj", "fi", "gi", "hi", "ji", "ki", "li", "oi", "pi", "qi", "fh", "gh", "hh", "jh", "kh", "lh", "ph", "qh", "fg", "gg", "jg", "kg", "lg", "og", "pg", "qg", "ff", "gf", "jf", "kf", "of", "pf", "qf", "rf", "fe", "qe", "re"];
    grid = grid.substr(0, 2);
    return ! good.includes(grid);

}



function getDestinationPoint(lat1, lon1, angle, km) {
    // angles in degrees
    lat1 = (lat1 * Math.PI / 180);
    lon1 = (lon1 * Math.PI / 180);
    angle = (angle * Math.PI / 180);
    // now angles in radians
    lat2 = Math.asin( Math.sin(lat1) * Math.cos( km/ 6371) + Math.cos(lat1) * Math.sin(km/ 6371) * Math.cos(angle));
    lon2 = lon1 + Math.atan2(Math.sin(angle)*Math.sin(km/ 6371) * Math.cos(lat1), Math.cos(km /6371) - Math.sin(lat1)*Math.sin(lat2));

    return { lat: (lat2 * 180/ Math.PI), lon: (lon2 * 180/ Math.PI)}; // angles back to degrees
}

function getSerial() {
    var chance = Math.random();
    var nr;
    if (chance > 0.5) { nr = Math.floor(100+Math.random() * 6500);
        if (nr > 2500) { nr = 100 + nr % 400; }
        if (nr == 599) { nr = '001'; }
    }
    else if (chance > 0.2) { nr = '0' + Math.floor(10 + Math.random() * 90); // 0xx
    }
    else {
        nr = '00' + Math.floor(1+Math.random() * 9);
    }
    return ''+nr;
}

function getContest(contest) {
    switch(contest) {
        case 'serial':
            var nr = getSerial();
            return ['5nn ' + cutOrNot(nr), nr];
        case 'grid':
            var grid = getGrid(1);
            return ['5nn ' + grid, grid];
        case 'loc':
            var grid = getGrid(2);
            return ['5nn ' + grid, grid];
        case 'vhf':
            var exchange = getSerial()+' '+getGrid(6);
            var ser = getSerial();
            var grid = getGrid(3);
            return ['5nn ' + cutOrNot(ser)+' '+grid, ser+' '+grid];
        case 'fd':
            var abbr = "ct,ema,me,nh,eny,nli,nnj,de,epa,al,ga,ky,nc,nfl,sc,ar,la,ms,nm,eb,lax,org,sb,scv,ak,az,ewa,id,mt,mi,oh,il,in,co,ia,ks,mn,ri,vt,wma,nny,snj,wny,mdc,wpa,sfl,tn,va,wcf,pr,vi,ntx,ok,stx,wtx,sdg,sf,sjv,sv,pac,nv,or,ut,wwa,wy,wv,wi,mo,ne,nd,sd,mar,ml,qc,one,onn,ons,sk,ab,bc,mb,nt,gta".split(',');
            var sec = pick(abbr);

            var afdcat = 'abcdef'.split('');
            var fdcat = pick(afdcat);
            var xmit;
            var fullcat;
            switch(fdcat) {
                case 'a':  
                case 'f':
                    xmit = Math.floor(Math.random() * 11 + 1);
                    if (xmit > 10) {
                        xmit = Math.floor(1 + Math.random() * 30);
                    }
                    break;
                case 'b':
                case 'c':
                    xmit = Math.floor(1 + Math.random() * 4);
                    break;
                case 'd':
                case 'e':
                    xmit = Math.floor(1 + Math.random() * 2);
            }
            fullcat = xmit + fdcat;
            return [cutOrNot('599 ')+ fullcat + ' ' + fullcat + ' ' + sec + ' ' + sec, fullcat + ' '+ sec];
    }
}

function MorseNode(ac, rate) {
    // ac is an audio context.
    this._oscillator = ac.createOscillator();
    this._gain = ac.createGain();

    this._gain.gain.value = 0;
    this._oscillator.type = 'sine';

    this._oscillator.connect(this._gain);
    this.key='computer';
    this.k='computer';


    if (rate == undefined)
        rate = 20;

    this._oscillator.frequency.value = 400;
    this._dot = 1.2 / rate; // formula from Wikipedia.


    this._oscillator.start(0);
}

MorseNode.prototype.connect = function(target) {
    return this._gain.connect(target);
};

MorseNode.prototype.MORSE = {
    'A': '.-',
    'B': '-...',
    'C': '-.-.',
    'D': '-..',
    'E': '.',
    'F': '..-.',
    'G': '--.',
    'H': '....',
    'I': '..',
    'J': '.---',
    'K': '-.-',
    'L': '.-..',
    'M': '--',
    'N': '-.',
    'O': '---',
    'P': '.--.',
    'Q': '--.-',
    'R': '.-.',
    'S': '...',
    'T': '-',
    'U': '..-',
    'V': '...-',
    'W': '.--',
    'X': '-..-',
    'Y': '-.--',
    'Z': '--..',

    '=': '-...-',
    '+': '.-.-.',
    '?': '..--..',
    ',': '--..--',
    '.': '.-.-.-',
    '>': '...-.-',

    '1': '.----',
    '2': '..---',
    '3': '...--',
    '4': '....-',
    '5': '.....',
    '6': '-....',
    '7': '--...',
    '8': '---..',
    '9': '----.',
    '0': '-----',
    '$': '$'

};

MorseNode.prototype.dotfac = function(t) {
    switch (this.k) {
            // t is type of dotvalue.  l=letter int. i=inter el. s=spaces .=dit -=dah 
        case 'computer':
            return 1;
        case 'cootie':
            if (t=='i') return 0.5;
            if (t=='l') return 0.8;
            return Math.random()*0.5+0.75;
        case 'snowflake': // perfectly out from perfection, useless 'look at me' swing
            if (t=='.' || t== 'i') return 0.8;
            if (t=='-') return 1.2;
            return 1;
        case 'paddle': // paddles have perfect i,.,-
            if (t=='l') return Math.random()*0.25+0.95;
            if (t=='s') return Math.random()*0.3+0.85;
            return 1;
        case 'paddlemed':
            if (t=='l') return Math.random()*0.5+0.85;
            if (t=='s') return Math.random()*0.7+0.66;
            return 1;
        case 'paddlebad':
            if (t=='l') return Math.random()*1.2+0.8;
            if (t=='s') return Math.random()*1.6+0.5;
            return 1;
        case 'straight': //i and . are rather too long than too short, s the inverse rest is random
            if (t=='.' || t=='i') return Math.random()*0.12+0.96;
            if (t=='s') return Math.random()*0.2+0.85;
            return Math.random()*0.2+0.9;
        case 'straightmed': //i and . are rather too long than too short, s the inverse rest is random
            if (t=='.' || t=='i') return Math.random()*0.33+0.95;
            if (t=='s') return Math.random()*0.2+0.85;
            return Math.random()*0.3+0.85;
        case 'straightbad':
            if (t=='.' || t=='i') return Math.random()*0.6+0.8;
            if (t=='s') return Math.random()*0.4+0.7;
            return Math.random()*0.5+0.75;
        case 'straightvbad':
            if (t=='.' || t=='i') return Math.random()*1.6+0.8;
            if (t=='s') return Math.random()*0.85+0.4;
            return Math.random()*0.8+0.6;
        case 'bug': // perfect i is a compromise to realism (only valid irl btwn dots)
            if (t=='.' || t== 'i') return 1;
            return Math.random()*0.3+0.85;
        case 'bugmed':
            if (t=='.' || t=='i') return 0.8; //perfect timing but too fast
            return Math.random()*0.5+0.82;
        case 'bugbad':
            if (t=='.' || t=='i') return 0.6;
            return Math.random()*0.8+0.8;
        case 'bugvbad':
            if (t=='.' || t=='i') return 0.5;
            if (t=='s' || t=='l') return Math.random()*1.3,+0.5;
            return Math.random()*1.1+0.6;
        case 'farnsworth2': //uses farnsworth
            if (t=='l') return 4 + Math.random()*0.5;
            if (t=='.' || t=='i') return Math.random()*0.33+0.95;
            if (t=='s') return Math.random()*0.4+4.85;
            return Math.random()*0.3+0.85;
        case 'farnsworth1': //uses farnsworth
            if (t=='s') return 6;
            if (t=='l') return 4;
        case 'elmer': //uses farnsworth
            if (t=='s') return 4;
            if (t=='l') return 1.5;
            return 1;
        }

}
MorseNode.prototype.playChar = function(t, c, l ) { //time, chars/elements, letter
    for (var i = 0; i < c.length; i++) {
        switch (c[i]) {
        case '.':
            this._gain.gain.setValueAtTime(1.0 * volume, t);
            t += this._dot*this.dotfac('.');
            this._gain.gain.setValueAtTime(0.0, t);
            if ((this.k=='bugbad' || this.k=='bugvbad' || this.k=='paddlebad') && ( ',?=56734>'.indexOf(l) >= 0 )) {
                if (Math.random()<0.07) { // in these signs, 7% of double points
                    t+= this._dot*this.dotfac('i');
                    this._gain.gain.setValueAtTime(1.0 * volume, t);
                    t += this._dot*this.dotfac('.');
                    this._gain.gain.setValueAtTime(0.0, t);
                }

            }

            break;
        case '-':
            this._gain.gain.setValueAtTime(1.0 * volume, t);
            t += 3 * this._dot*this.dotfac('-');
            this._gain.gain.setValueAtTime(0.0, t);
            break;
        case '$': //zeb Freq change
            freqOff *= -1;
            this._oscillator.frequency.setValueAtTime(freq.valueAsNumber + freqOff, t);
            break;
        }
        t += this._dot*this.dotfac('i');
    }
    return t;
};

MorseNode.prototype.playString = function(t, w, serious) { //serious won't change from pc key
    
    if (! serious) this.key=document.getElementById('key').value;
    this.k=this.key;
    if (this.key=='random')
    {
        this.k=pick(['paddle','straight','straightbad','bug','bugbad','bugmed','straightmed','paddlemed','paddlebad','cootie','computer','snowflake']);
    }
    w = w.toUpperCase();
    for (var i = 0; i < w.length; i++) {
        if (w[i] == ' ') {
            t += 3 * this._dot*this.dotfac('s'); // 3 dots from before, three here, and
                                // 1 from the ending letter before.
        }
        else if (this.MORSE[w[i]] != undefined) {
            t = this.playChar(t, this.MORSE[w[i]], w[i]);
            t += 2 * this._dot*this.dotfac('l');
        }
    }
    return t;
};

getGoodRST = function() {
    var rst = ['599 5nn', '599', '5nn', '579 579', '579 57n', '559 559', '5nn', '539 53n', '589 58n', '569 569', '529 529', '599 5nn', '449 44n', '519 51n', '599 599', '579 57n', '5nn 5nn'];
    var intro = ['ur rst ', 'ur rst rst ', 'rst is ', 'ur rst is ', 'rst rst ', 'ur rprt is ', 'ur ', 'u r ', 'ur rst '];
    return pick(intro) + pick(rst) + ' ';
};

getRST = function() {
    var rst = '';
    var twil = '';
    if (Math.random() > 0.5) {
        if (Math.random() > 0.5) {rst = '599';}
        else {rst = '5nn';}
        twil = '599';
    }
    else if (Math.random() > 0.5) {
        var choices = ['579', '559', '539'];
        rst = pick(choices);
        twil = rst;
    }
    else if (Math.random() > 0.8) {
        rst = Math.floor(Math.random() * 5 + 1).toString() + Math.floor(Math.random() * 9 + 1) + '9';
        twil = rst;
    }
    else {
        rst = Math.floor(Math.random() * 5 + 1).toString() + Math.floor(Math.random() * 9 + 1) + Math.floor(Math.random() * 9 + 1);
        twil = rst;
    }

    //doubling, replacing 9s with n
    if (Math.random() > 0.5) {rst = rst + ' '+ rst.replace(/9/g, 'n');}
    else {rst = rst + ' '+ rst;}
    var intro = ['ur rst is ', 'ur ', 'rst ', 'ur rst rst ', 'ur rprt is ', 'ur rst ', 'rst is ', 'ur rst '];
    rst = pick(intro) + rst;
    return [rst, twil];
};

getAge = function() {
    var age = Math.floor(Math.random() * 110 + 10).toString();
    var twil = age;
    var intro;
    intro = ['age hr ' + age, 'I am ' + age + ' years old', 'age ' + age + ' ' + age, 'my age is ' + age + ' ' + age];
    age = pick(intro) + ' ';
    return [age, twil];
};

getName = function() {
    var name = pick(names);
    var twil = name;
    if (Math.random() > 0.2) {
        name = name + ' '+ name;
    } //doubling the name is quite common;
    var intro = ['op hr ', 'name hr is ', 'op op ', 'my name is ', 'name name ', 'name hr ', 'op is ', 'op ', 'name ', 'name is '];
    name = pick(intro) + name;
    return [name, twil];
};

getClub = function(pclub,prev) {
    var clubs = ['skcc ', 'fists '];
    var mc;
    if (typeof pclub === "undefined") {
        mc = pick(clubs); 
    }
    else { //re-using same club
        mc = pclub+' ';
    }
    var intro = [mc, mc + ' ', 'hr ' + mc + 'nr ', 'hr ' + mc, 'my ' + mc + 'nr is ', ' ' + mc + 'nr ', mc + 'club member ', 'im ' + mc, 'im ' + mc + 'nr ', 'r u ' + mc + '? my nr is ', 'u ' + mc + '? im ' + mc + ' nr '];
    var over = pick(intro);
    var nr = Math.floor(Math.random() * 99999 + 100);
    if (nr == prev) nr += Math.floor(Math.random() * 10000 + 1);
    over += ' ' + nr + ' ';
    if (Math.random() > 0.3) over += nr + ' '; //doubling
    return [over, mc + nr];
};


getQTH = function(cc,fakeChance) {
    if (typeof(cc)==='undefined') cc=pick(pfxDb);
    if (typeof(fakeChance)==='undefined') fakeChance=0.25;
    var locPrefix = ['ab', 'bel', 'krem', 'cal', 'ben', 'por', 'val', 'dam', 'eka', 'grid', 'mar', 'fur', 'dil', 'ham', 'ida', 'lapi', 'luda', 'moran', 'berg', 'numa', 'pepe', 'hipo', 'ading', 'smer', 'tra', 'ger', 'camp', 'fort', 'mont', 'pass', 'win', 'yul', 'ter', 'mul', 'panes', 'coul', 'mil', 'ramm', 'lamb', 'sher', 'drac', 'rama', 'rattis', 'zeb', 'tip', 'leo', 'glad', 'jos', 'gast', 'davis', 'maris', 'got', 'hapi', 'fran', 'ali', 'poles', 'canon', 'vaca', 'kow', 'tex', 'her', 'sandi', 'lis', 'fos', 'fuls', 'haf', 'chap', 'neb', 'kal', 'nar', 'riven'];
    var locSuffix = ['ton', 'berg', 'lin', 'ano', 'ford', 'grad', 'ego', 'trig', 'besto', 'esten', 'burg', 'wick', 'stadt', 'field', 'ville', 'hia', 'mont', 'cot', 'boro', 'head', 'pol', 'eneva', 'eska', 'wa', 'hal', 'illon', 'wil', 'tana', 'ulino', 'enbad', 'pal', 'dell', 'nia'];
    var qth = pick(cityDb[cc]);
    var twil = qth;
    if (! document.getElementById('realqth').checked && Math.random() < fakeChance) {
        //construct a fake town name
        switch(cc) {
            case 'f':
            case 'on':
            case 've':
                locPPfx=['saint ','le ','mont'];
                locPSfx=[' le duc',' sur mer',' les bains',' le lac'];
                locPfx=['bel','val','camp','fort','ter','fran','cor','neu','gour','coul','ar','ver','mar','bor','cam','pois','carc','chate','char','cler','lise','angues','malan','anne','alte','per','sal','roman','haute','fonte','bis','gran','male','be','ombe'];
                locSfx=['beliard','leme','ville','mont','thune','let','masse','roi','viers','lai','ziers','rive','vin','ssy','illon','ars','rault','con','vaux','sault','teau','court','mont','nay','veresse','illac','rac','reuil','noise','vais','magny'];
                fake=pick(locPfx)+pick(locSfx);
                if (Math.random()<0.05){
                    if (Math.random()<0.5) fake+=pick(locPSfx);
                    else fake=pick(locPPfx)+fake;
                }
                break;
            case 'dl':
            case 'oe':
            case 'hb':  // *soupir* c'est la vie...
                locPPfx=['bad ','mittel','unten','alten','ober','gross','neu'];
                locPSfx=[' am rhein', ' am see'];
                locPfx=['kirchen','dussel','roggen','burten','ille','lauten','winter','esch','weiss','schwarzen','schenken','schil','muehlen','wolf','hof','frauen','orten','kappel','karls','johannis','muench','nuss','kriegs','balden','bald','rein','kassen','wallen','wiesen','hellen','kreuz','birkes','schwer','mars','schmallen','pfaff','frein','herbs','wein','ballen','schon','ors','her','wil','soll','schinken','liebs','grau','konigs'];
                locSfx=['heim','feld','bruck','ting','dorf','ried','hausen','thal','berg','wald','ingen','bach','dau','scheid','furt','stadt','leben','dorf','stein'];
                fake=pick(locPfx)+pick(locSfx);
                if (Math.random()<0.02) fake+=pick(locPSfx);
                if (Math.random()<0.1) fake=pick(locPPfx)+fake;
                break;
            case 'sm':
            case 'la':
                locPfx=['vaster','karls','halm','udde','vem','vala','strom','mala','troll','ny','marie','svens','var','gotte','vin','norr','byr','leik','hei','har','jorm','skal','ski','hammer','ul','os','eger','sau','byk','svine','kvel','skar','lar','tor','mos','jon','ram','hel'];
                locSfx=['sand','koping','svall','vik','dalen','holm','borg','fjord','berg','botn','by','voll','valen'];
                fake=pick(locPfx)+pick(locSfx);
                break;
            case 'oh':
                locPfx=['korva','kau','vaal','kii','hameen','mon','pelto','lepp','vil','tyn','vuor','turti','parvi','rova','mari','salmi','moskus','anet','kuu','leipi','palta','oter','vuoli','suuri','muu','laap','perni','raa','har','juon','huu'];
                locSfx=['jarvi','moinen','koski','maki','kkala','joki','by','vieska','niemi','vaara','lahti','saari','punka','jala','markku','ainen'];
                fake=pick(locPfx)+pick(locSfx);
                break;
            case 'r':
            case 'ur':
                locPfx=['kur','cherno','krasno','vol','kosmo','yar','bolsh','smirn','karaz','novo','khudy','kochev','drog','ir','severo','tas','zhar','volgo','glaz','bak','tol','khar','kalinin','svetla','pavlo','shim','uren','mama','kirov','gur','svobod','veliko','bogo','sovet','cherem','chelya','voda','lyub'];
                locSfx=['gorod','zero','skaya','mir','novka','binsk','gorsk','novgorod','pol','grad','borsk','polyarnyy','gan','vinka','skoye','kovo','shevo','rovsk','kamsk','yarsk','burg','birsk','netsk'];
                locPPfx=['nizhny ','stary '];
                fake=pick(locPfx)+pick(locSfx);
                if (Math.random()<0.01) fake=pick(locPPfx)+fake;
                break;

            case 'g':
            case 'gm':
            case 'gw':
            case 'ei':
            case 'k':
                locPPfx=['new ','south','new','little '];
                locPfx=['win','green','chester','ask','skip','carl','stone','glen','strat','inver','lan','apple','ard','bel','fin','glas','kil','wick','dur','conn','bree','rock','cair','cam','pen','mun','plough','marl','ox','west','middle','kings','war','peace','cat','black','white','meri','holy','water','farming','shef','red','rose','copper','flint','notting','ken','stock','grover','buck','lewis','old','oil','nor','fair','still','edge','liver','love','amber','burling','westing','lexing','craw','bos','man','rip','bow','thorn','scamp','brad','leigh','swan','claw','llan','ex','eas'];
                locSfx=['field','ton','how','wich','ham','by','thorpe','stoke','don','den','ford','hill','ster','port','isle','pool','bury','ville','brook','mont','wood','mill','bridge','wall','burg','view','dale','ley','burn','castle','tree','minster','hall','haugh','ton','holm'];
                fake=pick(locPfx)+pick(locSfx);
                if (Math.random()<0.01) fake=pick(locPPfx)+fake;
                break;
            case 'pa':
                locPPfx=['nieuw'];
                locPfx=['velden','groes','amer','schoon','zut','haar','noord','vriezen','heeren','hoog','an','oude','leer','middel','oost','moor','diks','zoot','dender','maast','geet','waal','tolle','hol','saankt'];
                locSfx=['wijk','daal','dam','doorn','beek','hoven','lo','huizen','recht','poort','bergen','hout','el','kerk','broek','meer'];
                locPSfx=[' aan zee'];

                fake=pick(locPfx)+pick(locSfx);
                if (Math.random()<0.02) fake+=pick(locPSfx);
                if (Math.random()<0.1) fake=pick(locPPfx)+fake;
                break;
            case 'py':
            case 'ct':
                latSyl=['ma','tal','cao','ceu','der','col','so','lem','be','cor','lao','ara','boa','tei','fun','por','pinho','velho','minha','mei','pen','tao','quei','hao'];
                fake="";

                j=Math.floor(Math.random()*2+2);
                for (i=0;i<j; i++) {
                    fake+=pick(latSyl);
                }
                break;
            case 'sp':
                locPPfx=['nowy '];
                locPfx=['czlu','zlot','chosz','lubj','prze','stara','wlosz','kroto','zba','krajen','pelcz','trze','slawo','wrzes','jaro','doma','boga','wojt','rusz','prosz','dabro','ostro','wlosz','gdy'];
                locSfx=['lce','mierz','wice','brzych','wiec','claw','polski','seczno','szyn','czowa','clawskie','czecin','kowo','czewsko','czyn','szyce','nsk','chlinek'];

                fake=pick(locPfx)+pick(locSfx);
                if (Math.random()<0.03) fake=pick(locPPfx)+fake;
                break;
            case 'ea':
                locPPfx=['palma de '];
                locPfx=['casa','torre','agua','almera','cana','monte','ali','villa','paja','mala','grana','bena','carta','campo','guada','val','trama','jara','pinta','mira','huel','queso','alca','muji','zara','naval','ara','castro'];
                locSfx=['mar','neras','dulce','pardo','mada','vieja','pino','lejo','jeros','verde','huerta','neda','castillo','rega','molinos','franca','lcazar','dillero','dorra','rez','tortas','hermosa'];
                locPSfx=[' del mar',' del rey',' de la frontera',' del rio',' del campo'];
                fake=pick(locPfx)+pick(locSfx);
                if (Math.random()<0.08) fake+=pick(locPSfx);
                if (Math.random()<0.01) fake=pick(locPPfx)+fake;
                break;

            case 'om':
            case 's5':
            case 'ha':
            case 'ok':

                locPfx=['hrad','treb','bude','prest','brez','ostrok','krem','smolen','smert','mohel','brat','kom','mork','velk','lip','morav','hron','plies','szik'];
                locSfx=['ovice','nice','senik','cenec','cianki','slav','jkov','zic','vice','nava','zany','tice','nica'];
                fake=pick(locPfx)+pick(locSfx);
                break;

            default:
                latSyl=['sil','ma','co','lu','ca','mi','mo','chi','te','bi','bu','de','di','da','me','ri','ra','lo','fi','par','mil','mel','la','del','fa','con','ti','pan','ta','na','pa','sa','so','gri','li','col','per','mar','pi','ro','nes','pu','po'];
                fake="";
                j=Math.random()*2+2;
                for (i=0;i<j; i++) {
                    fake+=pick(latSyl);
                }
        }


        qth = fake;
        twil = qth;
    }
    else if (Math.random() > 0.5) {qth = 'nr ' + qth; }
    if (Math.random() > 0.2) {qth = qth + ' '+ qth;} //doubling the qth is quite common
    var intro = ['qth ', 'my qth is ', 'qth is ', 'qth hr ', 'my qth ', 'qth qth '];
    qth = pick(intro) + qth;
    return [qth, twil];
};

getRig = function() {
    var rig = pick(rigs);
    var twil = rig;
    var intro = ['rig hr is ', 'rig is ', 'tx is ', 'my rig is a ', 'trx is ', 'rig '];
    rig = pick(intro) + rig;
    return [rig, twil];
};

sep = function() {
    var separators = [' ', ' = ', ' ', ' = ', ' = ', ' ', ' = '];
    return pick(separators);
};

getGreet = function(name) {
    var greets = ['gm ', 'ga ', 'ge ', 'gn ', 'hello ', 'gm ', 'ga ', 'ge '];
    var endings1 = ['es tnx fer call ', 'es tks call ', '= tnx fer call ', 'tnx call ', 'es tnx call ', 'tu call ', 'tu fer call ', 'tnx fer call ', ' ', '  '];
    var endings2 = ['es tnx fer rprt ', 'es tks rprt ', 'es tnx rprt ', '= tnx fer rprt ', 'es tnx fer call ', 'es tks fer rprt ', 'es tnx fb rprt '];
    var ending = '';

    if (!name) {
        ending = pick(endings1);
            if (Math.random() > 0.5) { name = 'om '; }
            else if (Math.random() > 0.5) { name = 'dr om '; }
            else { name = ''; }
        }
    else if (Math.random() > 0.3) {
        if (Math.random() > 0.5) {name = 'dr om ' + name + ' ';}
        else { name = 'dr ' + name + ' '; }
    }
        //else name stays the same
    if (!ending) {    //donc 2nd over
        if (Math.random() > 0.5) { ending = pick(endings2);
        }
        //else nothing, no ending
        else { ending = ' '; }
    }
    return pick(greets) + name + ' ' + ending;
};

drom = function(name) {
    var dice = Math.random();
    if (dromflag>0) {
        return ' ';
    }

    if (dice > 0.6) { name = 'dr ' + name; dromflag=1; }
    else if (dice > 0.5) { name = 'dr om ' + name;  dromflag=1;}
    else if (dice < 0.1) { name =''; }
    //default is just name 

    return name + ' ';
};

getEndover = function(call1, call2, sep, bk) {
    var endover = ['hw? ', 'ok? ', 'ok? ', 'qsl? ', 'so hw? ', 'hw cpi? ', 'so hw cpi? ', 'hw? ', 'hw cpy? ', 'hw? ', 'hw ? '];
    var hw = pick(endover);
    dromflag=0;
    if (Math.random() < bk) {
        return (Math.random() > bk ? hw : '') + ' BK  ';
    }
    return hw + sep + call2 + ' de ' + call1 + ' k   ';
};

getFullRig = function(rig) {
    var dice = Math.random();
    var fullrig = '';
    var ants = ['dipole ', 'doublet ', 'vert ', 'vertical ', 'endfed ', 'zepp ', '2el ', 'rand wire ', 'windom ', 'mag loop ', 'loop ', 'delta loop ', 'quad ', 'rhombic ', 'g5rv ', 'long wire ', 'w3dzz ', 'hamstick ', 'buddipole ', '3 el ', 'gp ', 'efhw ', 'inv vee ', '5el ', 'lw ', 'cobwebb ', 'levy ', 'ocf dipole ', 'fan dipole ', 'yagi ', 'moxon ', 'bazooka '];
    var pwr = ['100w ', '80w ', '5w 5w ', '25w ', '1tt watts ', '100 watts ', '50 watts ', '100w ', '5w qrp ', 'qrpp ', '5tw ', '10 watts ', '25w ', 'kw ', '200 watt ', '5tt watts ', '5 watts ', '1ttt watts ', 'full kw ', 'kw qro ', '100w ', '90 watts ', 'abt 5w ', 'abt 100w ', 'abt 1tt watts ', 'abt 100 watts ', 'full legal ', '1w 1w qrp ', '12w 12w ', '100w ', '400w 4ttw '];
    var intro = ['rig hr is ', 'rig is ', 'tx is ', 'my rig is a ', 'trx is ', 'rig '];
    var espwr = [' es pwr ', ' es pwr is ', sep() + ' pwr ', ' es my pwr is ', ' running '];
    var esant = [' es my ant is ', sep() + ' ant is ', sep() + ' ant ', ' es ant is ', sep() + ' my ant is ', ' into a ', ' into ', ' es ant '];
    var anth = ['up 18m ', 'up 12m ', '20m high ', 'up 20m ', 'up 30ft ', 'up 50ft ', 'up 25m ', 'up 10m ', '', '', '', '', '', 'at 15m ', 'at 18m ', '6m high ', 'up 8m ', '20m abv gnd '];
    var pwrs = ['tx ', 'rig ', 'pwr ', 'my pwr is ', 'running ', 'my pwr '];

    if (dice > 0.5) {
        fullrig = pick(intro) + rig + pick(espwr) + pick(pwr) + pick(esant) + pick(ants) + pick(anth);
    }
    else if (dice > 0.33) {
        fullrig = pick(intro) + rig; }
    else {
        fullrig = pick(pwrs) + pick(pwr);
    }
    if (dice < 0.16) {
        fullrig += pick(esant) + pick(ants) + pick(anth);
    }
    return fullrig + ' ';
};

getWX = function() {
    var intro = ['wx hr ', 'wx is ', 'wx hr is ', 'wx ', 'wx ', 'wx ', 'wx is '];
    var wx = ['rain ', 'cldy ', 'clr ', 'fine ', 'clouds ', 'ovc ', 'overcast ', 'storm ', 'fb ', 'snowing ', 'raining ', 'windy ', 'fair ', 'ok ', 'bad ', 'fog ', 'snow '];
    var estemp = ['es temp ', sep() + ' temp ', sep() + ' temp is ', 'es temp abt ', 'es temp is abt ', 'es temp '];
    var ret = pick(intro) + pick(wx);
    if (Math.random() > 0.3) {
        var temp = Math.floor(Math.random() * 60) - 20;
        if (temp > 6 && ret.indexOf('snow') > -1) { //if hot snow
            temp = Math.floor(Math.random() * 20) - 15;
        }
        if (temp < 0 && ret.indexOf('rain') > -1) { //if cold rain
            temp *= -1; //invert temp
        }
        if (temp < 0) { temp = 'minus ' + temp * -1;}
        return ret + pick(estemp) + temp + 'c ';
    }
    return ret;
};

endQSO = function(mycall, call, name, sep) {
    var tnx = ['tks ', 'tnx ', 'tu ', 'tnx ', 'tnx ', 'tks ', 'mni tnx ', 'mni tks ', 'tnx '];
    var fer = ['fer qso ', 'fer fb qso ', 'qso ', 'fer nice qso ', 'fer qso ', 'es '];
    var qsl = ['my qsl ok via buro ', 'my qsl ok ', 'pse qsl ', 'qsl ok ', '', '', '', '', ''];
    var cu = ['hpe cuagn ', 'cuagn ', 'hpe cul ', 'cul ', 'cuagn ', 'cu sn ', 'see u sn ', 'cu agn ', 'cu dwn the log ', 'hpe cuagn ', '', 'cu on cw '];
    var b73 = ['best 73 ', '73 ', '73 73 ', '73 77 ', 'best 73s ', '73 73 ', '73 73 ', 'vy 73 ', 'vy 73 73 ', '73 73 '];
    var closing = ['gl ', 'gb ', 'gl dx ', '77 ', 'gd dx ', 'tu 73 ', 'es gl ', 'es gb ', 'es dx ', '', '', '', '', ''];
    //
    // check countries for alternate closing
    if (mycall.charAt(0) == 'f' || call.charAt(0) == 'f') { //francais
        closing.splice(0, 0, 'merci ', 'merci ', 'mci ', 'au revoir ', 'a plus ');
    }
    else if (mycall.charAt(0) == 'd' || call.charAt(0) == 'd') { //deutsch
        closing.splice(0, 0, 'danke ', 'danke ', 'awdh '); // 'awdh= auf wiederhoren
    }
    else if (mycall.charAt(0) == 'i' || call.charAt(0) == 'i') { //italiano
        closing.splice(0, 0, 'ciao ', 'ciao ', 'grazie '); //
    }
    else if (mycall.charAt(0) == 'r' || call.charAt(0) == 'r') { //russian
        closing.splice(0, 0, 'dsw ', 'dsw ', 'dsw '); //
    }
    else if (mycall.charAt(0) == 'u' || call.charAt(0) == 'u') { //russian
        closing.splice(0, 0, 'dsw ', 'dsw ', 'dsw '); //
    }
    var tnxx = pick(tnx);
    var ferx = pick(fer);
    var qslx = pick(qsl);
    var cux = pick(cu);
    var b73x = pick(b73);
    var closingx = pick(closing);
    var end = sep + call + ' de ' + mycall + ' >   ';
    var dice = Math.random();

    if (Math.random() > 0.9) {
        end = '> ' + call + ' de ' + mycall + ' k   ';
    }

    if (dice > 0.95) {
        return 'tu es ' + b73x + end;
    }
    else if (dice > 0.8) {
        return tnxx + ferx + qslx + cux + b73x + closingx + end;
    }
    else if (dice > 0.6) {
        return b73x + tnxx + drom(name) + cux + closingx + end;
    }
    else if (dice > 0.4) {
        return tnxx + drom(name) + ferx + qslx + cux + b73x + closingx + end;
    }
    else if (dice > 0.2) {
        return tnxx + ferx + b73x + cux + end;
    }
    else { return b73x + qslx + tnxx + drom(name) + ferx + cux + closingx + end; }
};

roger = function(name) {
    var rogers = ['qsl ', 'rr ', 'r r ', 'en en ', 'rr ', 'r ', 'fb ', 'fb cpi ', 'all ok ', 'fb cpy '];
    if (Math.random() > 0.5) { return pick(rogers);}
    return pick(rogers) + drom(name) + sep();
};

getJob = function(age) {
    var jobs = ['emt ', 'baker ', 'stunt performer ', 'horse breeder ', 'farmer ', 'cop ', 'doctor ', 'pilot ', 'engineer ', 'pharmacist ', 'singer ', 'builder ', 'rock star ', 'scientist ', 'clown ', 'soldier ', 'dancer ', 'super hero ', 'cook ', 'painter ', 'teacher ', 'vet ', 'surgeon ', 'hunter ', 'waiter ', 'lumberjack ', 'dentist ', 'janitor ', 'skipper ', 'delivery man ', 'mechanic ', 'programmer ', 'postman ', 'helicopter pilot ', 'footballer ', 'lawyer ', 'attorney ', 'judge ', 'confectioner ', 'physician ', 'taxi driver ', 'seaman ', 'radio officer ', 'voice actor ', 'actress ', 'animal trainer ', 'architect ', 'carpenter ', 'biologist ', 'embalmer ', 'grocer ', 'fire fighter ', 'nurse ', 'clerk ', 'historian ', 'financial analyst ', 'psychologist ', 'funeral director ', 'photographer ', 'reporter ', 'decorator ', 'hairdresser ', 'plumber ', 'dispatcher ', 'jeweler ', 'bartender ', 'beautician ', 'dog trainer ', 'barber ', 'top model ', 'warden ', 'sailor ', 'optometrist ', 'ballet dancer ', 'linguist ', 'poet ', 'lens grinder ', 'butcher ', 'private detective ', 'radar technician ', 'musician ', 'roofer ', 'pawn broker ', 'rigger ', 'cashier ', 'salesman ', 'shampooer ', 'stenographer ', 'solderer ', 'stonemason ', 'travel clerk ', 'truck driver ', 'watch repairer ', 'traffic officer ', 'welder ', 'woodworker ', 'railway worker ', 'train driver ', 'writer ', 'tutor ', 'game designer ', 'barista ', 'astronaut ', 'hemp planter ', 'chocolatier ', 'roadman ', getAnimal()+' trainer '];
    var ex = ['used to be a ', 'im a retired ', 'im an ex ', 'i was a ', 'im a former ', 'hr ex '];
    var notyet = ['hr future ', 'id like to be a ', 'i want to be a ', 'im a future ', 'im studying to be a ', 'next year im a ', 'training to be a '];
    var job = '';
    if (! age) { age = Math.floor(Math.random() * 80) + 26; } // can't be a student, easier to check answer
    twil = pick(jobs);
    twil = twil.trim();

    if (age > 59 && Math.random() > 0.2) {
       job = pick(ex) + twil;
    }
    else if (age < 25) {
        if (Math.random() > 0.2) { job = pick(notyet) + twil;}
        else if (Math.random() > 0.5) { job = 'im in ' + twil + ' school '; }
        else { job = 'im a ' + twil + ' to be '; }
    }
    else { job = 'im a ' + twil; }
    return [job + sep(), twil];
};

fer = function() {
    fers = ['fer ', 'fer ', 'for ', 'fer ','','for ','fer '];
    return pick(fers);
};

hamFor = function(age) {
    var intro = ['bn a ham ', 'been a ham ', 'a ham ', 'doing cw ', 'tapping cw ', 'sending cw ', 'hamming ', 'on the air '];
    var ham = pick(intro);
    var time = Math.floor(Math.random() * (age - 12)) + 2;
    var years = ['yrs ', 'years '];
    var yr = new Date().getFullYear();

    if (Math.random() > 0.5) { ham += fer() + time + ' ' + pick(years); }
    else { ham += 'since ' + (yr - time)+' '; }
    return ham;
};

header = function(noBkStr) {  // choose if we start with BK or regular greeting
    dromflag=0;
    if (Math.random() < 0.6) {
        return '$bk ';
    }
    return noBkStr;
};


qrtExcuse = function(name) {
    var intro = ['= sri ', '= sri ' + drom(name), '= ', '= ok ' + drom(name)];
    var excuses = ['door rang ', 'getting tired ', 'dinner ready ', 'trx is smoking ', 'xyl is mad ', 'am sick ', 'qrm qrm ', 'qrn qrn ', 'qsb qsb ', 'hve to go nw ', 'friends at the door ', 'xyl complaining ', 'neighbours complaining ', 'tvi hi hi ', 'boss called me ', 'xyl needs me ', 'nap time ', 'om needs me ', 'kids arguing ', getAnimal()+'s want out ', getAnimal()+' is crazy ', 'antenna is falling ', 'earthquake hr ', 'meteor shower ', 'supper calling me ', 'bathroom calling ', 'cant explain but must qrt ', 'am too sleepy ', 'time to walk the '+getAnimal(), 'gotta take care of kids ', 'wife sick ', 'my darling wants to go out ', 'battery failing ', 'wrist aching ', 'hand hurts ', 'storm incoming ', 'locusts everywhere ', 'am too drunk ', getAnimal()+'wet carpet ', 'spouse is angry ', 'hurricane approaching ', 'ufo outside ', 'mom needs me ', 'my date is falling asleep ', 'shack too cold ', 'radio fuming ', 'weird smell ', 'hv to check smthing ', 'medication kickin in ', 'late ' + fer() + 'wedding ', 'house may be burning hi hi ', 'alarm ringing ', 'band is failing ', 'losing u ', 'late fer '+getHoliday(),'band condx changing fast ', 'need to buy drinks ', 'need a pause ', 'nd bk ', 'sked time ', 'qru ', 'rats chewing on coax ', 'getting bad restless legs syndrome ', 'getting moody ', 'spleen waking up ', 'urgent matter ', 'hafta go ', 'must go fishing ', 'bad headache nw ', 'meds time ', getHobby()+'time ','must drive xyl to '+getPlace()];
    var end = sep();
    var temp=pick(intro);
    var temp2=pick(excuses);
    if (temp.includes("sri")) {
        if (Math.random() > 0.7) { end = 'so '; }
    }
    else if (Math.random() < 0.2) { 
            temp2=''; // no excuse given
    } 
    return temp + temp2 + end;
}
getPlace = function() {
    var rLocation = ['the sea ', 'our highest mtn ', 'city center ', 'beach ', getFamous() + 'wedding place ', getFamous() + 's grave ', getFamous() + 'childhood home ', 'school ' + getFamous() + 's mother went to ', getFamous() + 'palace ', 'gov office ', 'the border ', 'space center ', 'former home of ' + getFamous(), getFamous() + 'family estate ', getFamous() + 'concert hall ', 'city hall ', 'roman ruins ', getHobby() + 'convention ', getAnimal() + 'farm '];
    return pick(rLocation);
}

getFamous= function() {
    var rFamous = ['albert einstein ', 'justin bieber ', 'isaac newton ', 'marilyn monroe ', 'sherlock holmes ', 'samuel morse ', 'alfred vail ', 'nikola tesla ', 'marconi ', 'elvis presley ', getRoyal(), getRoyal(), getRoyal(), 'elton john ', 'jacques chirac ', 'bob morane ', 'our president ', 'leo da vinci ', 'a famous poet ', 'rembrandt ', 'rene magritte ', 'salvador dali ', 'aragon ', 'rimbaud ', 'hertz ', 'al capone ', 'alfred nobel ', 'marie curie ', 'churchill ', getMiss()];
    return pick(rFamous);
}

getFullQSO = function() {
    temp=getCall();
    [call1,cc1] = [temp[1],temp[2]];
    temp=getCall();
    [call2,cc2]= [temp[1],temp[2]];
    var info1 = 0;
    var name1 = '';
    var name2 = '';
    var name1s = '';
    var name2s = '';
    var club1 = '';
    var clubgiven=0;
    var nr1 = 0;
    [name1s, name1] = getName();
    [name2s, name2] = getName();
    var header1 = '$' + call2 + ' de ' + call1 + sep();
    var header2 = '$' + call1 + ' de ' + call2 + sep();
    var seps = ['+ ', ' + ',' ', ' ', ' ', '  '];
    var sep1 = pick(seps);
    var sep2 = pick(seps);
    var ended = 0;
    var jobasked = 0;
    var ageasked = 0;
    var age = 0;
    var ages = '';
    [ages, age] = getAge();
    var vyends = ['$ 73 ee   $ ee', '$tu ee    $ee', '$ee      $ee', '$ee', '$tu ee    $e e', '$tu ee  $e', '$73 ee   $ e', ' $ese   $ee '];
    var vyend = pick(vyends);


    var fullqso = header1 + getGreet() + sep();

    if (Math.random() > 0.4) {fullqso = fullqso + getGoodRST() + sep() + name1s + sep() + getQTH(cc1)[0] + sep();}
    else {fullqso = fullqso + getGoodRST() + sep() + getQTH(cc1)[0] + sep() + name1s + sep();}
    //end the over:
    fullqso = fullqso + getEndover(call1, call2, sep1, 0.1);
    //2nd guy:
    fullqso = fullqso + header(header2) + getGreet(name1) + sep();
    if (Math.random() > 0.4) {fullqso = fullqso + getGoodRST() + sep() + name2s + sep() + getQTH(cc2)[0] + sep();}
    else {fullqso = fullqso + getGoodRST() + sep() + getQTH(cc2)[0] + sep() + name2s + sep();}
    fullqso = fullqso + getEndover(call2, call1, sep2, 0.2);
    //1st guy, 2nd time:
    fullqso = fullqso + header(header1) + roger(name2);
    if (Math.random() > 0.4) { fullqso += getFullRig(getRig()[1]) + sep() + getWX() + sep() + getEndover(call1, call2, sep1, 0.5); }
    else if (Math.random() > 0.2) {
        var over, temp;
        [over, temp] = getClub();
        [club1, nr1] = temp.split(' ');
        club1+= ' ';
        fullqso += over + getEndover(call1, call2, sep1, 0.8);
        clubgiven=1;
    }
    else { fullqso += qrtExcuse(name2) + endQSO(call1, call2, name2, sep1); ended = 1; }
    //2
    fullqso += header(header2) + roger(name1);
    if (ended > 0) {
        fullqso += endQSO(call2, call1, name1, sep2);
        return fullqso + vyend;
    }
    if (nr1 > 0) {
        //club nr was given
        if (Math.random() < 0.2) {
            var exc=['sri ' + drom(name1) + 'am not a ' + club1 + 'member ','sri ' + drom(name1) + 'no ' + club1 + 'nr ','no ' + club1 + 'nr hr ','sri '+drom(name1)+' forgot my '+club1+'nr hi hi ','no '+club1+'nr sri ','sri no club hr ','sri not a '+club1+'fan '];
            fullqso += pick(exc) + sep();
            club=''; nr1=-1;
        }
        else {
            fullqso += getClub(club1, nr1)[0] + sep();
            club1=''; nr1=-1; // avoid answering twice...
        }
    }    
    fullqso += getFullRig(getRig()[1]) + sep() + getWX() + sep(); // 2 always gives rig / wx
    if (Math.random() > 0.8) {
        ended = 1;
        fullqso += qrtExcuse(name1) + endQSO(call2, call1, name1, sep2);
    }
    else {
        fullqso += getEndover(call2, call1, sep2, 0.5);
    }
    //1
    fullqso += header(header1) + roger(name2);
    if (ended > 0) {
        fullqso += endQSO(call1, call2, name2, sep1);
        return fullqso + vyend;
    }

    if (Math.random() > 0.6) {
        if (Math.random() > 0.5) {
            fullqso += ages + 'es ' + hamFor(age) + sep() + getJob(age)[0];
            ageasked = 2; jobasked = 1;
        }
        else {
            fullqso += ages + 'es ' + getJob(age)[0];
            ageasked = 1; jobasked = 1;
        }
    }
    else if (Math.random() > 0.5) {
        fullqso += getJob(age)[0];
        jobasked = 1;
    }

    if (Math.random() > 0.6) { //qrt
        ended = 1;
        fullqso += qrtExcuse(name2) + endQSO(call1, call2, name2, sep1);
    } //club nr :
    else if (Math.random() > 0.5 && clubgiven < 1) {
        var over, temp;
        [over, temp] = getClub();
        [club1, nr1] = temp.split(' ');
        club1+= ' ';
        fullqso += over + getEndover(call1, call2, sep1, 0.6);

    }
    else { //non-sequitur info
        info1=1; 
        if (parseInt(call1.substr(-2, 1)) > -1 || parseInt(call1.substr(-3, 1) > -1)) { // if op1 has a 1- or 2-letter call, assume club
            var clubStn = ['hr club stn ', 'im testing club rig ', 'our club is nr ' + getPlace(), 'our club shack is next to ' + getPlace(), 'operating frm club ', 'qth radio club ', 'tx frm radio club ', 'rig is club stn ', 'club is close to ' + getPlace(), 'club shack on ' + getPlace(), 'special qsl for radio club anniversary ', 'today is radio club first day ', 'im a new club member ', 'we r a new club in town ','special event call fer '+getHoliday()];
            fullqso += pick(clubStn)+sep();
        }
            else { //non-club call
                var nonSeq = ['celebrating ' + getHoliday(), 'im preparing fer ' + getHoliday(), 'today is ' + getHoliday(), 'my favorite holiday is ' + getHoliday(), 'tmrw is ' + getHoliday(), 'special qsl fer ' + getHoliday(), 'i grew up nr ' + getPlace(), 'my elmer was ' + getFamous() + 'lookalike ', getKey(), getKey(), 'planning to build a house nr ' + getPlace(), 'will visit later ' + getPlace(), 'my qsl shows pic of ' + getPlace(), 'my qsl is a portrait of ' + getFamous() + 'i painted myself ', 'im writing a book abt ' + getFamous(), 'went last nite to ' + getPlace(), 'i wrote a song abt ' + getPlace(), 'i hv a pet ' + getAnimal(), 'i used to breed ' + getAnimal() + 's ', 'other hobby is ' + getHobby(), 'xyl is a ' + getHobby() + 'adept ', 'my qsl card was made at a ' + getHobby() + 'convention ', 'im in a ' + getHobby() + 'club ', 'i read books abt ' + getHobby(), 'selling ' + getHobby() + 'gear online ', 'my ' + getAnimal() + ' is named ' + getFamous(), 'i dream of ' + getHobby(), getKey(), 'always lkg fer ' + (Math.random() > 0.5 ? getAnimal() : getHobby()) + ' stuff ','my last meal was '+getAnimal()+' soup ','more info on qrz.com ','stn pics on qrz com '];
                fullqso += pick(nonSeq)+sep();
            }



        fullqso += getEndover(call1, call2, sep1, 0.6);
    }
    //2
    fullqso += header(header2) + roger(name1);

    if (ended > 0) {
        fullqso += endQSO(call2, call1, name1, sep2);
        return fullqso + vyend;
    }

    [ages, age] = getAge();
    if (ageasked > 0) {
        fullqso += ages + 'es ' + hamFor(age);
    }
    if (nr1 > 0) {
        //club nr was given
        if (Math.random() < 0.2) {
            var exc=['sri ' + drom(name1) + 'am not a ' + club1 + 'member ','sri ' + drom(name1) + 'no ' + club1 + 'nr ','no ' + club1 + 'nr hr ','sri '+drom(name1)+' forgot my '+club1+'nr hi hi ','no '+club1+'nr sri '];
            fullqso += pick(exc) + sep();
        }
        else {
            fullqso += getClub(club1, nr1)[0] + sep();
        }
    }    
    if (jobasked > 0) {
        if (ageasked > 0) { fullqso += sep(); }
        fullqso += getJob(age)[0];
    }
    if (info1 >0) {
        var tnxInfo=['tnx '+fer()+'info ','tks '+name1+' '+fer()+'info ','fb on ur info ','fb on all ','fb copy '];
        fullqso += pick(tnxInfo)+ ' = ';
    }
    if (Math.random() > 0.5) { //qrt
        ended = 1;
        fullqso += qrtExcuse(name1) + endQSO(call2, call1, name1, sep2);
    }
    else { //no qrt
        fullqso += getEndover(call2, call1, sep2, 0.5);
    }

    //1
    fullqso += header(header1) + roger(name2);
    if (ended > 0) {
        fullqso += endQSO(call1, call2, name2, sep1);
    }
    else {
        fullqso += qrtExcuse(name2) + endQSO(call1, call2, name2, sep1) + header(header2) + roger(name1) + endQSO(call2, call1, name1, sep2);
    }

    lastFullQso=fullqso + vyend;
    return lastFullQso;
}
cityDb={
    'dl':['berlin','berlin','hamburg','hamburg','munich','munich','koeln','cologne','frankfurt','frankfurt','stuttgart','stuttgart','duesseldorf','dusseldorf','dortmund','dortmund','essen','essen','leipzig','leipzig','bremen','bremen','dresden','dresden','hannover','hannover','nuremberg','nuremberg','duisburg','bochum','wuppertal','bielefeld','bonn','munster','mannheim','karlsruhe','gelsenkirchen','wiesbaden','chemnitz','augsburg','braunschweig','aachen','krefeld','halle','kiel','magdeburg','freiburg','hagen','erfurt','kassel','rostock','mainz','herne'],
    'oh':['helsinki','helsinki','espoo','espoo','tampere','tampere','vantaa','oulu','turku','lahti','kuopio','kouvola','pori','joensuu','vaasa','salo','nokia','porvoo'],
    'i':['milan','milan','naples','naples','rome','rome','turin','turin','venice','venice','florence','florence','bari','bari','palermo','palermo','bologna','bologna','catania','brescia','genoa','rimini','modena','verona','lecce','parma','ancona','trieste','pisa','ragusa','imola','tivoli','modica'],
    'f':['paris','paris','paris','chamonix','amiens','amiens','lille','lille','lyon','lyon','marseille','marseille','bordeaux','bordeaux','montpellier','morteau','besancon','rennes','tours','cambrai','toulouse','toulouse','caen','caen','nice','nice','rouen','brest','brest','cannes','perpignan','grasse','annecy','avignon','dijon','poitiers','troyes','grenoble','st etienne','evian','pau','limoges','douai','metz','le mans','montcuq','epinal','volvic','la rochelle','nantes','brive la gaillarde','vichy','strasbourg','lourdes','chantilly','bourges','valence','st quentin','mulhouse','dole'],
    'ea':['madrid','madrid','madrid','barcelona','barcelona','valencia','valencia','seville','seville','zaragoza','zaragoza','malaga','malaga','murcia','bilbao','alicante','cordoba','valladolid','vigo','gijon','elche','granada','oviedo','cartagena','sabadell','pamplona','terrassa','santander','salamanca','badajoz','marbella','leon','cadiz','lleida','tarragona'],
    'pa':['amsterdam','amsterdam','rotterdam','the hague','utrecht','eindhoven','tilburg','groningen','almere','breda','nijmegen','apeldoorn','haarlem','enschede','arnhem','amersfoort','zaanstad','zwolle'],
    'r':['moscow','moscow','moscow','st petersburg','st petersburg','saint petersburg','rostov on don','kazan','belgorod','bryansk','vladimir','voronezh','ivanovo','kaluga','kostroma','kursk','lipetsk','oryol','ryazan','smolensk','tambov','tver','tula','yaroslavl','arkhangelsk','vologda','kaliningrad','petrozavodsk','syktyvkar','murmansk','veliky novgorod','pskov','simferopol','sevastopol','penza','samara','saransk','nizhny novgorod'],
    'ur':['kyiv','kyiv','kharkiv','dnipro','odesa','donetsk','zaporizhia','lviv','kryvyi rih','mykolaiv','mariupol','luhansk','makiivka','vinnytsia','simferopol','sevastopol','kherson','poltava','chernihiv','cherkasy','sumy','zhytomyr','kamianske','rivne','chernivtsi','ternopil','lutsk','kerch','yalta'],
    'sm':['stockholm','stockholm','stockholm','malmo','gothenburg','uppsala','vasteras','orebro','linkoping','helsingborg','jonkoping','norrkoping','lund','umea','gavle','solna','vaxjo','sodertalje','boras','karlstad','eskilstuna','halmstad'],
    'sp':['warsaw','warsaw','krakow','lodz','wroclaw','poznan','gdansk','szczecin','bydgoszcz','lublin','katowice','bialystok','gdynia','czestochowa','radom','sosnowiec','torun','kielce'],
    've':['toronto','toronto','ottawa','ottawa','halifax','halifax','halifax','sydney','truro','kentville','pictou','new glasgow','fredericton','moncton','edmundston','bathurst','miramichi','montreal','montreal','montreal','gatineau','quebec city','trois rivieres','saguenay','matagami','kuujjuaq','inukjuak','sherbrooke','granby','joliette','rimouski','drummondville'],
    'g':['london','london','london','birmingham','liverpool','leeds','sheffield','bristol','manchester','leicester','coventry','nottingham','brent','ealing','plymouth','southampton','reading','derby','greenwich','camden','dudley','portsmouth','luton','preston','sutton','sunderland','norwich','walsall','swindon','poole','bolton','ipswich','york','oxford','brighton','slough','gloucester','exeter','chesterfield','crawley','woking'],
    'gm':['glasgow','glasgow','edinburgh','edinburgh','aberdeen','dundee','paisley','east kilbride','livingston','hamilton','ayr','perth','dunfermline','inverness','irvine','stirling','falkirk','hawick','port ellen'],
    'gw':['cardiff','cardiff','swansea','newport','merthyr tydfil','wrexham','barry','neath','cwmbran','bridgend','llanelli','aberdare','colwyn bay'],
    'hb':['bern','bern','zuerich','zurich','basel','geneva','geneva','lausanne','lausanne','sion','sierre','neuchatel','fribourg','le locle','la chaux de fonds','biel','bienne','zug','winterthur','lucerne','st gallen','lugano','bellinzona','thun','koeniz','schaffhausen','vernier','chur','uster','lancy','emmen','yverdon','montreux','dietikon','interlaken','wil','baar','bulle','aarau','nyon','vevey','baden','olten','martigny','locarno','delemont'],
    'la':['oslo','oslo','bergen','trondheim','stavanger','kristiansand','sandnes','fredrikstad','tromso','skien','drammen','sarpsborg','bodo','sandefjord','alesund','larvik','vardo','mo i rana'],
    'ok':['prague','prague','brno','brno','prague','ostrava','plzen','liberec','olomouc','zlin','most'],
    'ha':['budapest','budapest','budapest','debrecen','szeged','miskolc','pecs','gyor'],
    'k':['new york','new york','ny','washington, dc','chicago','philadelphia','columbus','detroit','memphis','boston','nashville','baltimore','atlanta','miami','pittsburgh','tampa','charlotte, nc','louisville','los angeles','houston','chicago','phoenix','san antonio','san diego','san jose','austin','jacksonville','san francisco','seattle','fresno, ca','worcester, ma','providence, ri','manchester, nh'],
    'py':['sao paulo','sao paulo','sao paulo','rio','rio de janeiro', 'rio de janeiro','sao paulo','salvador','brasilia','fortaleza','belo horizonte','manaus','curitiba','recife','porto alegre','belem','goiania','campinas','guarulhos','sao luis','maceio','sao goncalo'],
    'ct':['lisbon','lisbon','porto','porto','lisbon','vila nova de gaia','amadora','braga','coimbra','almada','setubal','barreiro','queluz','aveiro','viseu','rio tinto','leiria','evora','faro','guarda'],
    'lz':['sofia','sofia','plovdiv','varna','burgas','ruse','stara zagora','pleven','dobrich','sliven','shumen','pernik','haskovo','yambol','vratsa'],
    '9a':['zagreb','zagreb','split','rijeka','osijek','zadar','pula','sisak'],
    'on':['antwerp','antwerp','ghent','charleroi','liege','brussels','bruges','namur','mons','leuven','mechelen','aalst','ostend','tournai','hasselt','genk','verviers','mouscron','ypres','binche'],
    's5':['ljubljana','ljubljana','maribor','celje','kranj','velenje','koper'],
    'yt':['belgrade','belgrade','belgrade','novi sad','nis','kragujevac','leskovac','subotica','pristina'],
    'oe':['vienna','vienna','vienna','graz','linz','salzburg','innsbruck','klagenfurt','villach','wels','dornbirn'],
    'ly':['vilnius','kaunas','klaipeda','vilnius','kaunas','siauliai','panevezys','alytus','marijampole','mazeikiai','jonava','utena'],
    'yo':['bucharest','bucharest','cluj','timisoara','iasi','constanta','craiova','brasov','galati','ploiesti','oradea','braila','arad','pitesti','bacau','tulcea'],
    'oz':['copenhagen','copenhagen','copenhagen','aarhus','odense','aalborg','abenra','skagen','esbjerg'],
    'om':['bratislava','bratislava','kosice','presov','zilina','nitra','trnava'],
    '4x':['jerusalem','jerusalem','tel aviv','tel aviv','haifa','rishon lezion','petah tikva','ashdod','netanya','beersheba'],
    'ei':['dublin','dublin','dublin','dublin','cork','limerick','galway','waterford','drogheda']
};


pfxAka={
    'dl':['dl','df','do','dm','db','dl','dc','dg','dh','dk','dl'],
    'oh':['oh','of','og','oh','oh'],
    'i':['ik','i','iz','ik','iz'],
    'pa':['pa','pd','pc','ph','pb','pe','pa','pd','pc','pa'],
    'r':['r','ua','ra','r','ua','ra','rt','rv','rw'],
    'ur':['ur','ur','us','us','ut'],
    'sm':['sm','sm','sm','sa','sk'],
    'sp':['sp','sp','sq','so','hf'],
    've':['ve','ve','va'],
    'ea':['ea','ea','ea','eb','ao'],
    'g':['g','g','gg','gg','m','m','g','g','2e','gk'],
    'gm':['gm','gm','gm','mm','mm','2m','mm'],
    'gw':['gw','gw','mw','mw','2w'],
    'la':['la','la','lb','lc'],
    'ok':['ok','ok','ok','ol'],
    'ha':['ha','ha','hg'],
    'k':['k','k','w','w','wa','wu','ka','kb','kp','kt','nv','n','aa','ac','ak','wa','wb','ww','kw'],
    'py':['py','pu','py','pu','pp','pt'],
    '4x':['4x','4x','4z'],
    'f':['f','f','f','f','f','f','f','tm','f','f','f','f'],
    'yt':['yt','yu','yu'],
    'ei':['ei'],
    'om':['om'],
    'oz':['oz'],
    'ly':['ly'],
    'yo':['yo'],
    's5':['s5'],
    '9a':['9a'],
    'ct':['ct'],
    'lz':['lz'],
    'hb':['hb'],
    'on':['on'],
    'oe':['oe']
};

pfxDb=['dl','dl','dl','oh','oh','ok','ok','oe','oe','f','f','i','i','pa','pa','r','r','sm','sm','sp','sp','r','ve','ve','yo','yo','yl','g','g','ea','ea','ea','la','la','r','k','k','la','gm','pa','pa','dl','r','r','sm','s5','sp','ve','k','yt','ct','g','4x','9a','dl','dl','ei','ha','k','hb','i','on','pa','sm','gm','gw','py','ly','ly','oz','om','yo','ur','ur','ur','ur','lz','lz','hb','hb','g','g','on','f','i','g'];

getCall=function(){ // shd return call, twil, cntry call
    var call="";
    var charset="abcdefghijklmnopqrstuvwxyz";
    //prefixes I often hear (mainly 20m JT in hb9)
    // var common=['dl','oh','ok','oe','f','iz','ik','pa','r','sm','sp','ua','ur','us','ve','yo','yl','ea','g','ra','la'];
    // var others=['k','w','ja','wa','lb','mm','pd','do','rt','pc','rv','rw','sa','s5','sq','sv','t','tf','va','vk','wu','yu','yv','zl','zs','ct','2e','4x','5p','9a','9h','dh','df','e7','eb','ei','es','ew','ha','jh','ka','kb','kp','kt','nv','ac','ox','ak','hb','ce','cn','co','i','mw','on','ph','eg','ec','gk','sk','gm','gw','is','wy','pu'];

    cc=pick(pfxDb);
    call=pick(pfxAka[cc]);

    call=call+Math.floor(Math.random()*10);
    var suffixlen=3;
    if (Math.random()>0.95) { suffixlen=1; }
    else if (Math.random()> 0.8) { suffixlen=2; }
    for (var i=0; i<suffixlen; i++){
        call=call+charset.charAt(Math.floor(Math.random() *charset.length));
    }
    var twil=call;
    call=call+" "+call;
    var intro=[' de '+call+' +',' cq de '+call+' pse k',' cq de '+call+' k'];
    call=pick(intro);
    return [call,twil,cc];
}
setCat= function(){
    acb=document.getElementsByClassName('cb');
    for (i=0;i<acb.length; i++) {
        acb[i].checked=true;
    }
    return false; //so it doesn't activate the link

}
unsetCat= function(){
    acb=document.getElementsByClassName('cb');
    for (i=0;i<acb.length; i++) {
        acb[i].checked=false;
    }
    return false; //so it doesn't activate the link

}
resetScore= function(){
    score=0; count=0;
    $('#score').html('0/0 &nbsp;');
    return false;
}

getQSO=function(){
    var checkedCategories=[];
    $('.cb:checkbox:checked').val(function() {checkedCategories.push(this.name);});
    if (checkedCategories == "") { //no category selected means all categories
        checkedCategories=['cjob','cname','crst','cclub','crig','ccall','cage','cqth'];
    }
    qzl();



    var text=$('#itext').val();
    if (twil != 'xyzzy de hb9fxw') {  //we're not starting the game, 
        if (text=='') { text='no copy'; }
        //sanitize answer
        text=text.toLowerCase();
        text=text.replace(/^n[ea]*r /,"");
        text=text.replace(/-/,' ');
        if (text.replace(/\s+/g,"") == "5nn") { text="599"; }
        if (choice=='ctest'){
            text=text.replace(/^599 ?/,"");
        }

        if (choice=='cclub'){
            text=text.replace(/nr /,'');
            text=text.replace(/^f.* /,'fists ');
            text=text.replace(/^s.* /,'skcc ');
        }
        if (choice=='crig'){
            text=text.replace(/(\w+?)\W*?(\d+)/,'$1 $2');
            twil=twil.replace(/(\w+?)\W*?(\d+)/,'$1 $2');
        }

        // we need to check the answer
        if (text.indexOf(twil) > -1 ) { // answer was correct
        // if (twil.replace(/\s+/g,"") == text.replace(/\s+/g,""))  { //strict check
            if (againpressed==0) {
                score++;
                if (document.getElementById("autospeed").checked)
                {
                    document.getElementById("speed").value = parseInt(wpm.value) + 1
                }
            }
            correct=true;
            morse2.playString(ac.currentTime, "c",true);
        }
        else {  //answer was wrong
            correct=false;
            morse2.playString(ac.currentTime, "?",true);
            if (document.getElementById("autospeed").checked && parseInt(wpm.value) >5 )
            {
                document.getElementById("speed").value = parseInt(wpm.value) - 1;
            }
        }
    }
    else {
        //starting the game
        //change the button label
        $('#play').html('Answer');
    }

    $('#itext').val(''); //reset the answer field
    choice=pick(checkedCategories);
    var qso='';
    var om=$('#name').val();
    switch (choice) {
        case 'crst':
            [qso,twil]=getRST();
            break;
        case 'cage':
            [qso,twil]=getAge();
            break;
        case 'cqth':
            [qso,twil]=getQTH();
            break;
        case 'crig':
            [qso,twil]=getRig();
            break;
        case 'cname':
            [qso,twil]=getName();
            break;
        case 'cjob':
            [qso,twil]=getJob();
            break;
        case 'cclub':
            [qso,twil]=getClub();
            break;
        case 'ccall':
            [qso,twil]=getCall();
            break;
        case 'ctest':
            [qso,twil]=getContest($('#stest').val());
            break;
    }

    if (choice != 'ccall' && choice != 'ctest'){
        var omchoice=Math.random();
        var om2="";
        if (omchoice>0.8) {
            om2=om+" ";
        }
        else if (omchoice > 0.6) {
            om2="dr "+om+" ";
        }
        else if (omchoice > 0.4) {
            om2= "om ";
        }
        else if (omchoice > 0.25) {
            om2= "dr om ";
        }
        else {
            om2= "";
        }
            
        if (Math.random()>0.7) {
            var fluff=['tks '+om2,'tnx '+om2,'rr '+om2+'= ','all ok '+om2+'= ','ok '+om2,'fb on ur info '+om2,'fb cpi '+om2,'tu '+om2+'= '];
            qso=pick(fluff)+qso;
        }
        else if (Math.random()>0.7) {
            var fluff=[' hi hi',' = so hw?',' qsl?', ' bk', ' btu '+om2,' = qru','= hw?',' +',' ok?'];
            qso+=pick(fluff);
        }
        qso=' = '+qso;
    }
    var prevtable=$('#logcontainer tbody').html();
    if ( againpressed==1){
        if (correct) {
            $('#logcontainer tbody').html('<tr><td>'+lastqso+'</td><td class="repeat-correct-log-el">'+text+'</td></tr>');
        }
        else {
            $('#logcontainer tbody').html('<tr><td>'+lastqso+'</td><td class="wrong-log-el">'+text+'</td></tr>');
        }
    }
    else if (correct ) {  // answer was correct
        $('#logcontainer tbody').html('<tr><td>'+lastqso+'</td><td class="correct-log-el">'+text+'</td></tr>');
    }
    else {  //answer was wrong
        $('#logcontainer tbody').html('<tr><td>'+lastqso+'</td><td class="wrong-log-el">'+text+'</td></tr>');
    }
    $('#logcontainer tbody').append(prevtable);
    lastqso=qso;

    $('#score').html(score+'/'+count+'&nbsp;');
    count++;
    return qso;
}

var freq=document.querySelector("#freq")
var freqOff=Math.floor(Math.random()*12+3); // frequency offset for full qso delta 6-30 Hz
var ac = new (window.AudioContext || window.webkitAudioContext)();
var filter= ac.createBiquadFilter(); 
filter.frequency.value=freq.value;
filter.Q.value=0;
filter.gain.value=0.5;
var filter2= ac.createBiquadFilter();
filter2.frequency.value=freq.value;
filter2.Q.value=0;
filter2.gain.value=0.5;

var twil="xyzzy de hb9fxw";
var choice=""; // category
var lastqso="";
var score=0;
var count=0;
var correct=false;
var wpm=document.querySelector("#speed")

var morse = new MorseNode(ac, parseInt(wpm.value));
morse.connect(filter);
var morse2= new MorseNode(ac, parseInt(wpm.value));

morse2.connect(filter2);

filter.connect(ac.destination);
filter2.connect(ac.destination);


var delayed=""
var againpressed=0

var volume=1.0;
var agn = document.querySelector("#again");
agn.onclick = function() {
    againpressed=1
    // morse._dot=1.2/parseFloat(wpm.value);
    // morse._oscillator.frequency.value=parseInt(freq.value);
    // morse2._dot=1.2/parseFloat(wpm.value*1.2);
    // morse2._oscillator.frequency.value=parseInt(freq.value)-30;

    morse._oscillator.stop(0) //i
    morse = new MorseNode(ac, parseInt(wpm.value)); //i
    morse.connect(filter); //i
    filter.connect(ac.destination); //i end

    morse._dot=1.2/parseFloat(wpm.value);
    morse._oscillator.frequency.value=parseInt(freq.value);
    morse.playString(ac.currentTime+10*morse2._dot, delayed);
}

var btn = document.querySelector("#play");
btn.onclick = function() {
    morse._dot=1.2/parseFloat(wpm.value);
    morse._oscillator.frequency.value=parseInt(freq.value);
    morse2._dot=1.2/parseFloat(wpm.value*1.2);
    morse2._oscillator.frequency.value=parseInt(freq.value)-30;
    delayed=getQSO();

    againpressed=0
    morse._oscillator.stop(0) //i
    morse = new MorseNode(ac, parseInt(wpm.value)); //i
    morse.connect(filter); //i
    filter.connect(ac.destination); //i end

    morse._dot=1.2/parseFloat(wpm.value);
    morse._oscillator.frequency.value=parseInt(freq.value);
    morse.playString(ac.currentTime+20*morse2._dot, " "+ delayed);
    document.getElementById('itext').disabled=false;
}

var btnFullQSO=document.querySelector("#fullqso");
var btn2=document.querySelector("#test");
var nameb=document.querySelector("#name");
btn2.onclick = function() {
    unlock();
    morse._oscillator.stop(0) //i
    morse = new MorseNode(ac, parseInt(wpm.value)); //i
    morse.connect(filter); //i
    filter.connect(ac.destination); //i end

    morse._dot=1.2/parseFloat(wpm.value);
    morse._oscillator.frequency.value=parseInt(freq.value);
    morse.playString(ac.currentTime, " vvv de "+nameb.value);
    // noSleep.disable();

}
var txt=document.querySelector("#itext");
txt.onkeypress = function(e) {
    if(e.keyCode == 13)
        btn.click();
}

btnFullQSO.onclick = function() {
    freqOff=Math.floor(Math.random()*20+4); // frequency offset for full qso delta 8-48 Hz
    fullQL();
    var qso=getFullQSO();
    lastFullQso=qso;
    document.getElementById('itext').disabled=true;
    unlock();
    morse._oscillator.stop(0)
    morse= new MorseNode(ac, parseInt(freq.value));
    morse.connect(filter); //i
    filter.connect(ac.destination); //i end

    morse._dot=1.2/parseFloat(wpm.value);
    morse._oscillator.frequency.value=parseInt(freq.value);
    morse.playString(ac.currentTime, " "+qso);
    if (document.getElementById('printqso').checked ){
        qso=qso.replace(/\$/g,'</p><p>');
        qso=qso.replace(/ > /g,' &lt;SK&gt;&nbsp;'); 

        document.getElementById("fullqsodiv").innerHTML = "<p>&nbsp;<p><p>"+qso+'</p><p>&nbsp; </p>';
    }
    //console.log(qso);
    // noSleep.enable();
}

var mute=document.querySelector("#mute");
mute.onclick = function() {
    document.getElementById('itext').disabled=false;
    // noSleep.disable();

    morse._oscillator.stop(0) //i
    morse = new MorseNode(ac, parseInt(wpm.value)); //i
    morse.connect(filter); //i
    filter.connect(ac.destination); //i end

    morse._dot=1.2/parseFloat(wpm.value);
    morse._oscillator.frequency.value=parseInt(freq.value);
    morse.playString(ac.currentTime, " ");

}

var stop=document.querySelector("#stop");
stop.onclick= function() {
    document.getElementById('itext').disabled=false;
    morse._oscillator.stop(0) //i
    morse = new MorseNode(ac, parseInt(wpm.value)); //i
    morse.connect(filter); //i
    filter.connect(ac.destination); //i end

    morse._dot=1.2/parseFloat(wpm.value);
    morse._oscillator.frequency.value=parseInt(freq.value);
    morse.playString(ac.currentTime, " ");
}

var volctl=document.querySelector("#volume");
volctl.onchange = function() {
    volume=volctl.value/100.0;
}

var repeatBtn=document.querySelector("#repeat");
repeatBtn.onclick= function() {
    var qso=lastFullQso;
    document.getElementById('itext').disabled=true;
    unlock();
    morse._oscillator.stop(0)
    morse= new MorseNode(ac, parseInt(freq.value));
    morse.connect(filter); //i
    filter.connect(ac.destination); //i end

    morse._dot=1.2/parseFloat(wpm.value);
    morse._oscillator.frequency.value=parseInt(freq.value);
    morse.playString(ac.currentTime, " "+qso);
    // noSleep.enable();
}

var unlocked = false;

function qzl() {
    return false; // Vail Seiuchy: the original pinged seiuchy.macache.com for anonymous usage stats. That server is gone, so this is disabled.
    try {
        if (window.XMLHttpRequest) xmlhttp = new XMLHttpRequest();
        else xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");

        xmlhttp.open("GET"," http://seiuchy.macache.com/qzl.php?sp="+wpm.value+'&fr='+freq.value+'&nm='+$('#name').val()+'&k='+$('#key').val()+'&asa='+$('#autospeed:checked').length+'&rqth='+$('#realqth:checked').length+'&cname='+$('#cname:checked').length+'&crig='+$('#crig:checked').length+'&ccall='+$('#ccall:checked').length+'&cage='+$('#cage:checked').length+'&crst='+$('#crst:checked').length+'&cqth='+$('#cqth:checked').length+'&cjob='+$('#cjob:checked').length+'&cclub='+$('#cclub:checked').length+'&ctest='+$('#ctest:checked').length+'&stest='+$('#stest').val(),true);
        xmlhttp.send();
     
        return false;
    }catch (e) {
        //oops
        return false;
    }
}
function fullQL() {
    return false; // Vail Seiuchy: disabled usage ping to the now-offline seiuchy.macache.com (see qzl above).
    try {
        if (window.XMLHttpRequest) xmlhttp = new XMLHttpRequest();
        else xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");

        xmlhttp.open("GET"," http://seiuchy.macache.com/qzl.php?fq=1&sp="+wpm.value+'&fr='+freq.value+'&nm='+$('#name').val()+'&rqth='+$('#realqth:checked').length+'&k='+$('#key').val(),true);
        xmlhttp.send();
     
        return false;
    }catch (e) {
        //oops
        return false;
    }
}
function getCountry() {
    var countries=['france ','spain ','italy ','sweden ','mali ','norway ','iceland ','russia ','peru ','texas ','switzerland ','austria ','china ','japan ','uk ','finland ','germany ','poland ','uganda ','algeria ','nigeria ','mongolia ','tibet ','vietnam ','brazil ','iowa ','canada ','scotland ','jersey ','lybia '];
    return pick(countries);
}
function getMiss() {
    return "miss "+getCountry()+Math.floor(Math.random()*200+1816)+' ';
}
function pick(ar) {
    return ar[Math.floor(Math.random()*ar.length)];
}
function getHoliday() {
    var adj=['young ','free ','proud ','strong ','happy ','peace ','fresh ','pure ','mere ','national ','local ','amazing ','new ','cool ','buy ','weird ','praise ','crisp ','burnt ','waste of ','pack ','spare ','spring ','summer ','winter ','silly ','love ','red ','dry ','fake ','tired ','try the ','dont eat ','prime ','show your ','magic ','foreign ','funny ','old ','hot ','vampire ','plastic '];
    var noun=['cabbage ','wives ','girls ','beer ','fruit ','milk ','books ','music ','art ','scents ','tech ','gifts ','wires ','hugs ','smiles ','effort ','clothes ','pants ','masks ','cookies ','walks ','zombies ','sugar ','hats ','cheese ','wool ','moon ','stars ','sky ','paint ','boys ','dads ','pie ','numbers ','feet ','nails ','glasses ','hair ','nurses ','face ',getAnimal()+'s ',getHobby()+'skills '];
    var ter=['day ','festival ','celebration ','march ','parade ','commemoration ','festival','day ','day ','festival ','day ','day ','march ','parade ','day '];
    return pick(adj)+pick(noun)+pick(ter);
}

function getKey() {
    var intro=['testing ','im testing ','using ','im using ','just received ','trying ','i just bought ','i just found ','key hr ','key is ','my key is a used ','sending wid trusty ','xyl got me ','first day using ','fixed my old '];
    var keys=['speedx sk ','k8ra paddle ','begali simplex ','begali sculpture ','kent paddle ','n0sa paddle ','bug ','nye viking ','kent sk ','vizkey cootie ','sawblade cootie ','homemade key ','czech mil key ','by1 key ','schurr key ','bencher hex ','j38 key ','ameco k4 key ','hi mound paddles ','junker key ','navy flameproof key ','j37 key ','camelback key ','soviet mil key '];
    return pick(intro)+pick(keys);
}

function getAnimal() {
    var animal=['penguin','dog','cat','bird','snake','sloth','poney','camel','koala','raccoon','pig','chicken','llama','rat','rabbit','spider'];
    return pick(animal);
}

function getHobby() {
    var hob=['ufo research ','painting ','snowboarding ','cooking ','riding ','photo ','modelling ','astronomy ','astrology ','maths ','yoga ','pilates ','reading ','poetry ','woodwking ',getAnimal()+' breeding ','collecting stuffed '+getAnimal()+'s ','gaming ','knitting ','whistling ','yoyo ','jodel '];
    return pick(hob);
}

$('#legendsettings').click( // toggle contest selector visibility
  function(){
    if ( $('#divsettings').is(':visible') )
      { 
          $('#divsettings').hide(); 
          // $('#intro').hide(); 
      }
    else
      { 
          $('#divsettings').show(); 
          // $('#intro').show(); 
      }
  }
);
