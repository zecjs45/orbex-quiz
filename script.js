import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA47oR0wO287xmZwFx-D3yFHtze3bwT1kU",
    authDomain: "orbexquiz.firebaseapp.com",
    projectId: "orbexquiz",
    storageBucket: "orbexquiz.appspot.com",
    messagingSenderId: "123041277929",
    appId: "1:123041277929:web:e5df07c5316dab119ccd78"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// BANCO DE DADOS DAS QUESTÕES DE TESTE
const questoes = [
    {
        pergunta: "Qual é o planeta mais próximo do Sol?",
        opcoes: ["Vênus", "Terra", "Mercúrio", "Marte"],
        correta: 2,
        dificuldade: "Facil"
    },
    {
        pergunta: "O que é um buraco negro?",
        opcoes: ["Uma estrela cadente", "Gravidade extrema", "Planeta escuro", "Galáxia vazia"],
        correta: 1,
        dificuldade: "Medio"
    },
    {
        pergunta: "Qual é o nome da nossa galáxia?",
        opcoes: ["Andrômeda", "Via Láctea", "Sombrero", "Triângulo"],
        correta: 1,
        dificuldade: "Facil"
    }
];

const orbex = {
    user: null,
    score: 0,
    currentQuestionIndex: 0,
    questoesAtuais: [],

    init: function() {
        // 1. CAPTURA O RETORNO DO REDIRECIONAMENTO E FORÇA A ABERTURA DA TELA
        getRedirectResult(auth).then((result) => {
            if (result) {
                this.user = result.user;
                const userNameEl = document.getElementById('user-name');
                const userAvatarEl = document.getElementById('user-avatar');
                if(userNameEl) userNameEl.innerText = result.user.displayName;
                if(userAvatarEl && result.user.photoURL) userAvatarEl.src = result.user.photoURL;
                
                // O COMANDO QUE FALTAVA PARA ABRIR A NAVE:
                this.showScreen('screen-main');
            }
        }).catch((error) => {
            console.error("Erro no redirecionamento:", error);
        });

        // 2. MONITORA SE O COMANDANTE JÁ ESTÁ LOGADO AO ENTRAR NO SITE
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.user = user;
                const userNameEl = document.getElementById('user-name');
                const userAvatarEl = document.getElementById('user-avatar');
                
                if(userNameEl) userNameEl.innerText = user.displayName;
                if(userAvatarEl && user.photoURL) userAvatarEl.src = user.photoURL;
                
                this.showScreen('screen-main');
            }
            // Removemos a ordem de ir para a tela de login aqui para evitar conflitos de carregamento no telemóvel
        });

        // 3. LIGA OS BOTÕES
        const btnLogin = document.getElementById('btn-google-login');
        if(btnLogin) {
            btnLogin.addEventListener('click', () => this.login());
        }

        const btnLogout = document.getElementById('btn-logout');
        if(btnLogout) {
            btnLogout.addEventListener('click', () => {
                auth.signOut().then(() => this.showScreen('screen-login'));
            });
        }
    },

    login: function() {
        const provider = new GoogleAuthProvider();
        signInWithRedirect(auth, provider);
    },

    showScreen: function(screenId) {
        document.querySelectorAll('.screen').forEach(s => {
            s.classList.remove('active');
            s.classList.add('hidden');
        });
        
        const targetScreen = document.getElementById(screenId);
        if(targetScreen) {
            targetScreen.classList.remove('hidden');
            targetScreen.classList.add('active');
        }
        
        document.getElementById('screen-login').style.display = screenId === 'screen-login' ? 'flex' : 'none';
    },

    prepareQuiz: function(dificuldade) {
        this.questoesAtuais = questoes.filter(q => q.dificuldade === dificuldade);
        if(this.questoesAtuais.length === 0) this.questoesAtuais = questoes;
        
        this.questoesAtuais.sort(() => Math.random() - 0.5);
        this.score = 0;
        this.currentQuestionIndex = 0;
        
        const scoreEl = document.getElementById('current-score');
        if(scoreEl) scoreEl.innerText = this.score;
        
        this.showScreen('screen-quiz');
        this.loadQuestion();
    },

    loadQuestion: function() {
        if (this.currentQuestionIndex >= this.questoesAtuais.length) {
            this.finishQuiz();
            return;
        }

        const q = this.questoesAtuais[this.currentQuestionIndex];
        const questionText = document.getElementById('question-text');
        if(questionText) questionText.innerText = q.pergunta;
        
        const grid = document.getElementById('answers-grid');
        if(grid) {
            grid.innerHTML = '';
            q.opcoes.forEach((opcao, index) => {
                const btn = document.createElement('button');
                btn.className = 'btn-sci-fi answer-btn';
                btn.innerText = opcao;
                btn.onclick = () => this.checkAnswer(index, q.correta);
                grid.appendChild(btn);
            });
        }
    },

    checkAnswer: function(escolhida, correta) {
        if (escolhida === correta) {
            this.score += 100;
            const scoreEl = document.getElementById('current-score');
            if(scoreEl) scoreEl.innerText = this.score;
        }
        
        this.currentQuestionIndex++;
        setTimeout(() => this.loadQuestion(), 500); 
    },

    finishQuiz: async function() {
        const finalScoreEl = document.getElementById('final-score-text');
        if(finalScoreEl) finalScoreEl.innerText = this.score;
        
        this.showScreen('screen-result');
        
        if (this.score > 0 && this.user) {
            try {
                const globalScoreRef = doc(db, "global_scores", this.user.uid);
                const globalSnap = await getDoc(globalScoreRef);

                if (globalSnap.exists()) {
                    let pontuacaoAntiga = globalSnap.data().score;
                    if (this.score > pontuacaoAntiga) {
                        await updateDoc(globalScoreRef, {
                            score: this.score,
                            date: serverTimestamp(),
                            name: this.user.displayName
                        });
                    }
                } else {
                    await setDoc(globalScoreRef, {
                        uid: this.user.uid,
                        name: this.user.displayName,
                        score: this.score,
                        date: serverTimestamp()
                    });
                }
            } catch (error) {
                console.error("Erro no ranking:", error);
            }
        }
    }
};

window.orbex = orbex;
window.onload = () => orbex.init();
