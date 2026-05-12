// 音效对象
const audio = {
    hit: new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAA'),
    victory: new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAA')
};

// 游戏数据
const gameData = {
    // 人物数据
    characters: {
        'boss-female': {
            name: '刻薄女老板',
            title: '中年PUA大师',
            quotes: [
                '你最近工作状态不好啊，是不是家里有什么事？',
                '年轻人要多吃苦，这样才能成长。',
                '你看看人家小王，同样是996，人家怎么就没怨言？',
                '我这都是为你好，等你以后就明白了。',
                '这点小事都做不好，你还能做什么？',
                '你应该感谢公司给你这个机会锻炼。',
                '加班是正常的，哪个成功的人不是这样过来的？',
                '你的能力还不够，需要再努力。',
                '你这样的态度，以后怎么在社会上立足？',
                '我对你的期望很高，别让我失望。',
                '这点挫折都承受不了，以后怎么成大事？',
                '你应该把公司当成自己的家。',
                '你的工作效率太低了，这样下去不行。',
                '我批评你是因为重视你，否则我才懒得管你。',
                '你看看人家的工作态度，再看看你。'
            ]
        },
        'boss-male': {
            name: '油腻男老板',
            title: '画饼专家',
            quotes: [
                '等公司上市了，大家都是股东。',
                '今年好好干，年底给你涨薪20%。',
                '我们公司未来五年要成为行业第一。',
                '跟着我干，保证你三年内买车买房。',
                '现在苦点累点，将来都是值得的。',
                '我们正在布局一个大项目，成功了大家都有份。',
                '公司现在处于上升期，正是你们大展拳脚的时候。',
                '等这个项目完成，我们就可以轻松了。',
                '我看好你，以后公司的核心岗位非你莫属。',
                '我们要做的是改变世界的事情。',
                '现在的付出，将来都会加倍回报给你。',
                '我们公司的发展前景不可限量。',
                '等公司扩大规模，你就是部门经理。',
                '跟着我，你会学到很多东西。',
                '我们的产品将会改变整个行业。'
            ]
        },
        'colleague-male': {
            name: '猥琐男同事',
            title: '告状专业户',
            quotes: [
                '我昨天看到你下班很早啊。',
                '经理，我觉得有些事情需要向你汇报。',
                '不是我多嘴，但是...',
                '我只是实事求是，没有针对谁。',
                '你这样做不太符合公司规定吧？',
                '我也是为了公司好，才说这些的。',
                '我觉得有些人工作态度有问题。',
                '经理，你知道吗？他昨天...',
                '我只是想让大家都能公平竞争。',
                '我不是打小报告，只是反映情况。',
                '有些人总是占公司便宜。',
                '经理，我有个事情想和你单独说。',
                '我觉得团队里有些人拖后腿。',
                '不是我挑剔，但是你的工作确实有问题。',
                '我只是希望大家都能遵守公司制度。'
            ]
        },
        'colleague-female': {
            name: '阴阳女同事',
            title: '冷嘲热讽王',
            quotes: [
                '哇，你好厉害啊，这么简单的事情都能做成这样。',
                '还是你们年轻人有活力，不像我，老了。',
                '你这么努力，肯定能升职加薪的。',
                '我可不敢像你那样，我能力有限。',
                '你家里条件好，当然不用这么拼了。',
                '还是你们单身好，不像我，要照顾家庭。',
                '你这么优秀，肯定有很多人追吧？',
                '我要是有你这么好的运气就好了。',
                '你这么有能力，肯定看不上我们这些普通人。',
                '还是你们学历高，不像我，没文化。',
                '你穿得这么好看，是不是要去约会啊？',
                '我可不敢像你那样顶撞领导。',
                '你这么会说话，肯定很受大家欢迎吧？',
                '我要是有你这么好的口才就好了。',
                '你这么年轻，前途无量啊。'
            ]
        }
    },
    // 回怼金句
    counterQuotes: [
        '我的工作状态很好，不需要你操心。',
        '加班不是衡量工作能力的标准。',
        '每个人都有自己的工作方式，不需要和别人比较。',
        '感谢你的关心，但我有自己的判断。',
        '我会做好自己的工作，请不要随意评价。',
        '公司给我的是工资，不是恩情。',
        '我的时间很宝贵，请尊重我的私人时间。',
        '我的能力如何，用业绩说话。',
        '我的态度没问题，有问题的是你的管理方式。',
        '我会尽力而为，但请不要给我施加不必要的压力。'
    ]
};

// 游戏状态
let gameState = {
    currentCharacter: null,
    health: 100,
    combo: 0,
    comboTimer: null
};

// DOM元素
const elements = {
    gameInfo: document.getElementById('gameInfo'),
    characterSelect: document.getElementById('characterSelect'),
    gamePlay: document.getElementById('gamePlay'),
    victoryScreen: document.getElementById('victoryScreen'),
    currentCharacterName: document.getElementById('currentCharacterName'),
    currentCharacterTitle: document.getElementById('currentCharacterTitle'),
    puaQuote: document.getElementById('puaQuote'),
    counterQuote: document.getElementById('counterQuote'),
    healthBarFill: document.getElementById('healthBarFill'),
    healthBarText: document.getElementById('healthBarText'),
    comboCount: document.getElementById('comboCount'),
    characterBody: document.getElementById('characterBody'),
    damageNumbers: document.getElementById('damageNumbers')
};

// 显示人物选择界面
function showCharacterSelect() {
    elements.gameInfo.style.display = 'none';
    elements.characterSelect.style.display = 'block';
}

// 选择人物
function selectCharacter(characterId) {
    gameState.currentCharacter = characterId;
    const character = gameData.characters[characterId];
    
    elements.currentCharacterName.textContent = character.name;
    elements.currentCharacterTitle.textContent = character.title;
    
    // 设置人物身体的data-character属性
    elements.characterBody.setAttribute('data-character', characterId);
    
    // 重置游戏状态
    gameState.health = 100;
    gameState.combo = 0;
    updateHealthBar();
    updateComboCount();
    
    // 显示游戏界面
    elements.characterSelect.style.display = 'none';
    elements.gamePlay.style.display = 'block';
    
    // 添加身体部位点击事件
    addBodyPartListeners();
}

// 添加身体部位点击事件
function addBodyPartListeners() {
    const bodyParts = elements.characterBody.querySelectorAll('.body-part');
    bodyParts.forEach(part => {
        part.addEventListener('click', () => {
            handleBodyPartClick(part);
        });
    });
}

// 处理身体部位点击
function handleBodyPartClick(part) {
    // 播放打击音效
    audio.hit.play().catch(e => console.log('Audio play failed:', e));
    
    // 添加人物受打击动画
    elements.characterBody.classList.add('hit');
    setTimeout(() => {
        elements.characterBody.classList.remove('hit');
    }, 300);
    
    // 计算伤害
    const damage = calculateDamage();
    
    // 更新健康值
    gameState.health = Math.max(0, gameState.health - damage);
    updateHealthBar();
    
    // 显示伤害数字
    showDamageNumber(part, damage);
    
    // 显示打击特效
    showHitEffect(part);
    
    // 更新连击
    updateCombo();
    
    // 显示PUA语录和回怼金句
    showQuotes();
    
    // 检查胜利条件
    if (gameState.health <= 0) {
        showVictoryScreen();
    }
}

// 计算伤害
function calculateDamage() {
    // 基础伤害
    const baseDamage = 5 + Math.random() * 5;
    
    // 连击加成
    const comboMultiplier = 1 + (gameState.combo * 0.1);
    
    return Math.floor(baseDamage * comboMultiplier);
}

// 显示伤害数字
function showDamageNumber(part, damage) {
    const rect = part.getBoundingClientRect();
    const bodyRect = elements.characterBody.getBoundingClientRect();
    
    const damageNumber = document.createElement('div');
    damageNumber.classList.add('damage-number');
    damageNumber.textContent = `-${damage}`;
    damageNumber.style.left = `${rect.left - bodyRect.left + rect.width / 2}px`;
    damageNumber.style.top = `${rect.top - bodyRect.top}px`;
    
    elements.damageNumbers.appendChild(damageNumber);
    
    // 1秒后移除
    setTimeout(() => {
        damageNumber.remove();
    }, 1000);
}

// 显示打击特效
function showHitEffect(part) {
    const rect = part.getBoundingClientRect();
    const bodyRect = elements.characterBody.getBoundingClientRect();
    
    const hitEffect = document.createElement('div');
    hitEffect.classList.add('hit-effect');
    hitEffect.style.left = `${rect.left - bodyRect.left + rect.width / 2 - 20}px`;
    hitEffect.style.top = `${rect.top - bodyRect.top + rect.height / 2 - 20}px`;
    
    elements.characterBody.appendChild(hitEffect);
    
    // 0.3秒后移除
    setTimeout(() => {
        hitEffect.remove();
    }, 300);
}

// 更新连击
function updateCombo() {
    gameState.combo++;
    updateComboCount();
    
    // 重置连击计时器
    clearTimeout(gameState.comboTimer);
    gameState.comboTimer = setTimeout(() => {
        gameState.combo = 0;
        updateComboCount();
    }, 1000);
}

// 更新连击计数显示
function updateComboCount() {
    elements.comboCount.textContent = gameState.combo;
}

// 更新血条
function updateHealthBar() {
    const percentage = gameState.health;
    elements.healthBarFill.style.width = `${percentage}%`;
    elements.healthBarText.textContent = `${Math.floor(percentage)}%`;
}

// 显示PUA语录和回怼金句
function showQuotes() {
    const character = gameData.characters[gameState.currentCharacter];
    const randomQuoteIndex = Math.floor(Math.random() * character.quotes.length);
    const randomCounterIndex = Math.floor(Math.random() * gameData.counterQuotes.length);
    
    elements.puaQuote.textContent = `"${character.quotes[randomQuoteIndex]}"`;
    elements.counterQuote.textContent = `"${gameData.counterQuotes[randomCounterIndex]}"`;
}

// 显示胜利界面
function showVictoryScreen() {
    // 播放胜利音效
    audio.victory.play().catch(e => console.log('Audio play failed:', e));
    
    elements.gamePlay.style.display = 'none';
    elements.victoryScreen.style.display = 'block';
}

// 返回人物选择界面
function backToCharacterSelect() {
    elements.gamePlay.style.display = 'none';
    elements.characterSelect.style.display = 'block';
}

// 重启游戏
function restartGame() {
    elements.victoryScreen.style.display = 'none';
    elements.characterSelect.style.display = 'block';
}

// 初始化游戏
function initGame() {
    // 初始显示游戏说明
    elements.gameInfo.style.display = 'block';
    elements.characterSelect.style.display = 'none';
    elements.gamePlay.style.display = 'none';
    elements.victoryScreen.style.display = 'none';
}

// 启动游戏
initGame();