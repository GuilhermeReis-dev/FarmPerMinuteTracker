# -*- coding: utf-8 -*-
import sqlite3
import os
import sys
import json
import datetime
from collections import Counter
from pathlib import Path # Importa a biblioteca Path para lidar com caminhos de forma mais fácil

# --- INÍCIO DA ALTERAÇÃO OBRIGATÓRIA ---

# Nome do seu aplicativo. Usaremos para criar uma pasta segura.
APP_NAME = "ElectronFarmTracker"
DB_NAME = "farm_tracker.db"

def get_database_path():
    """
    Determina e cria o caminho para o arquivo do banco de dados na pasta de dados do aplicativo,
    garantindo que os dados do usuário sejam persistentes.
    """
    # No Windows, os.getenv('APPDATA') retorna o caminho para a pasta AppData\Roaming do usuário
    # (ex: C:\Users\SeuUsuario\AppData\Roaming). Este é o local correto e seguro para dados.
    # Em outros sistemas operacionais, usamos o home do usuário como base.
    if sys.platform == "win32":
        # Constrói o caminho completo: C:\Users\SeuUsuario\AppData\Roaming\ElectronFarmTracker
        app_data_dir = Path(os.getenv('APPDATA')) / APP_NAME
    else:
        # Fallback para Linux/macOS
        app_data_dir = Path.home() / f".{APP_NAME.lower()}"

    # Cria a pasta do seu aplicativo dentro de AppData\Roaming, se ela ainda não existir.
    app_data_dir.mkdir(parents=True, exist_ok=True)

    # Retorna o caminho completo para o arquivo do banco de dados.
    # Ex: C:\Users\SeuUsuario\AppData\Roaming\ElectronFarmTracker\farm_tracker.db
    return app_data_dir / DB_NAME

# A variável DATABASE_PATH agora é definida dinamicamente pela função.
DATABASE_PATH = get_database_path()

# --- FIM DA ALTERAÇÃO OBRIGATÓRIA ---


def setup_database():
    """Conecta-se ao banco de dados e cria as tabelas se elas não existirem."""
    # Usa a variável global DATABASE_PATH que agora aponta para o local seguro.
    db_conn = sqlite3.connect(DATABASE_PATH, detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES)
    db_conn.text_factory = str
    cursor = db_conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")

    # O resto da sua função de setup continua exatamente igual...
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS minha_farm_base (
            id INTEGER PRIMARY KEY,
            nome_meta TEXT DEFAULT 'Minha Meta Pessoal',
            tempo_referencia_segundos INTEGER,
            farm_referencia INTEGER,
            fpm_calculado REAL
        );
    """)
    cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_minha_farm_base_single_row ON minha_farm_base (id);")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS outros_perfis_base (
            id_perfil INTEGER PRIMARY KEY AUTOINCREMENT,
            nome_perfil TEXT UNIQUE NOT NULL
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS outras_partidas_exemplo (
            id_partida_exemplo INTEGER PRIMARY KEY AUTOINCREMENT,
            id_perfil_fk INTEGER NOT NULL,
            tempo_partida_segundos INTEGER,
            farm_partida INTEGER,
            fpm_calculado REAL,
            FOREIGN KEY (id_perfil_fk) REFERENCES outros_perfis_base(id_perfil) ON DELETE CASCADE
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS historico_partidas_usuario (
            id_partida_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
            data_hora TEXT NOT NULL,
            tempo_partida_segundos INTEGER NOT NULL,
            farm_obtido INTEGER NOT NULL,
            fpm_calculado REAL,
            avaliacao TEXT,
            dificuldade_partida TEXT CHECK(dificuldade_partida IN ('EASY', 'NORMAL', 'HARD', NULL)),
            personagem_utilizado TEXT,
            origem TEXT CHECK(origem IN ('Manual', 'Cronômetro'))
        );
    """)

    table_info = cursor.execute("PRAGMA table_info(historico_partidas_usuario);").fetchall()
    column_names = [info[1] for info in table_info]
    if 'dificuldade_partida' not in column_names:
        try: cursor.execute("ALTER TABLE historico_partidas_usuario ADD COLUMN dificuldade_partida TEXT CHECK(dificuldade_partida IN ('EASY', 'NORMAL', 'HARD', NULL))")
        except sqlite3.OperationalError: pass
    if 'personagem_utilizado' not in column_names:
        try: cursor.execute("ALTER TABLE historico_partidas_usuario ADD COLUMN personagem_utilizado TEXT")
        except sqlite3.OperationalError: pass
    if 'origem' not in column_names:
        try: cursor.execute("ALTER TABLE historico_partidas_usuario ADD COLUMN origem TEXT CHECK(origem IN ('Manual', 'Cronômetro'))")
        except sqlite3.OperationalError: pass

    db_conn.commit()
    return db_conn

# --- LÓGICA DE NEGÓCIOS (AÇÕES) ---
# NENHUMA ALTERAÇÃO NECESSÁRIA AQUI PARA BAIXO.
# TODO O SEU CÓDIGO RESTANTE PERMANECE EXATAMENTE O MESMO.

def get_personal_goal_logic(db_conn):
    """Busca ou cria a meta pessoal do usuário."""
    cursor = db_conn.cursor()
    cursor.execute("SELECT id, nome_meta, tempo_referencia_segundos, farm_referencia, fpm_calculado FROM minha_farm_base WHERE id = 1 LIMIT 1")
    meta = cursor.fetchone()
    db_full_path = str(DATABASE_PATH)
    if meta:
        return {"id": meta[0], "nome_meta": meta[1], "tempo_segundos": meta[2], "farm_referencia": meta[3], "fpm_meta": meta[4], "exists": True, "db_path": db_full_path, "success": True}
    else:
        nome_padrao = "Minha Meta Pessoal"
        try:
            cursor.execute("INSERT OR IGNORE INTO minha_farm_base (id, nome_meta, tempo_referencia_segundos, farm_referencia, fpm_calculado) VALUES (1, ?, 0, 0, 0.0)", (nome_padrao,))
            db_conn.commit()
            cursor.execute("SELECT id, nome_meta, tempo_referencia_segundos, farm_referencia, fpm_calculado FROM minha_farm_base WHERE id = 1 LIMIT 1")
            meta_criada = cursor.fetchone()
            if meta_criada:
                return {"id": meta_criada[0], "nome_meta": meta_criada[1], "tempo_segundos": meta_criada[2], "farm_referencia": meta_criada[3], "fpm_meta": meta_criada[4], "exists": True, "db_path": db_full_path, "success": True}
        except sqlite3.Error as e:
            return {"exists": False, "nome_meta": nome_padrao, "tempo_segundos": 0, "farm_referencia": 0, "fpm_meta": 0.0, "db_path": db_full_path, "success": False, "message": str(e)}
        return {"exists": False, "nome_meta": nome_padrao, "tempo_segundos": 0, "farm_referencia": 0, "fpm_meta": 0.0, "db_path": db_full_path, "success": True}

def save_personal_goal_logic(db_conn, data):
    """Salva ou atualiza a meta pessoal."""
    nome = data.get('nome_meta', 'Minha Meta Pessoal').strip()
    tempo_segundos = data.get('tempo_segundos', 0)
    farm_referencia = data.get('farm_referencia', 0)
    if not nome: return {"success": False, "message": "Nome da meta não pode ser vazio."}
    try:
        tempo_segundos = int(tempo_segundos); farm_referencia = int(farm_referencia)
        if not (farm_referencia >= 0 and tempo_segundos >= 0): raise ValueError()
    except ValueError: return {"success": False, "message": "Tempo e Farm devem ser números válidos."}
    fpm_calculado = (farm_referencia / tempo_segundos) * 60 if tempo_segundos > 0 else 0.0
    cursor = db_conn.cursor()
    try:
        cursor.execute("UPDATE minha_farm_base SET nome_meta = ?, tempo_referencia_segundos = ?, farm_referencia = ?, fpm_calculado = ? WHERE id = 1", (nome, tempo_segundos, farm_referencia, fpm_calculado))
        if cursor.rowcount == 0:
            cursor.execute("INSERT INTO minha_farm_base (id, nome_meta, tempo_referencia_segundos, farm_referencia, fpm_calculado) VALUES (1, ?, ?, ?, ?)", (nome, tempo_segundos, farm_referencia, fpm_calculado))
        db_conn.commit()
        return {"success": True, "message": "Meta pessoal salva!", "updated_goal": get_personal_goal_logic(db_conn)}
    except sqlite3.Error as e: return {"success": False, "message": f"Erro BD: {e}"}

def delete_personal_goal_logic(db_conn, data):
    """Exclui a meta pessoal."""
    cursor = db_conn.cursor()
    try:
        cursor.execute("DELETE FROM minha_farm_base WHERE id = 1"); db_conn.commit()
        return {"success": True, "message": "Meta pessoal excluída."} if cursor.rowcount > 0 else {"success": False, "message": "Nenhuma meta para excluir."}
    except sqlite3.Error as e: return {"success": False, "message": f"Erro BD: {e}"}

def get_other_profiles_logic(db_conn):
    """Busca todos os perfis de outros jogadores."""
    cursor = db_conn.cursor()
    cursor.execute("SELECT id_perfil, nome_perfil FROM outros_perfis_base ORDER BY nome_perfil LIMIT 3")
    profiles = [{"id": row[0], "name": row[1]} for row in cursor.fetchall()]
    return {"success": True, "profiles": profiles}

def add_other_profile_logic(db_conn, data):
    """Adiciona um novo perfil de outro jogador."""
    profile_name = data.get('name', '').strip()
    if not profile_name: return {"success": False, "message": "Nome do perfil não pode ser vazio."}
    cursor = db_conn.cursor()
    try:
        cursor.execute("SELECT COUNT(*) FROM outros_perfis_base")
        if cursor.fetchone()[0] >= 3: return {"success": False, "message": "Limite de 3 perfis atingido."}
        cursor.execute("INSERT INTO outros_perfis_base (nome_perfil) VALUES (?)", (profile_name,))
        db_conn.commit()
        new_id = cursor.lastrowid
        return {"success": True, "message": f"Perfil '{profile_name}' adicionado.", "new_profile": {"id": new_id, "name": profile_name}}
    except sqlite3.IntegrityError: return {"success": False, "message": f"Perfil '{profile_name}' já existe."}
    except sqlite3.Error as e: return {"success": False, "message": f"Erro BD: {e}"}

def delete_other_profile_logic(db_conn, data):
    """Exclui um perfil de outro jogador."""
    profile_id = data.get('id')
    if not profile_id: return {"success": False, "message": "ID do perfil não fornecido."}
    cursor = db_conn.cursor()
    try:
        cursor.execute("DELETE FROM outros_perfis_base WHERE id_perfil = ?", (profile_id,))
        db_conn.commit()
        return {"success": True, "message": "Perfil excluído."} if cursor.rowcount > 0 else {"success": False, "message": "Perfil não encontrado."}
    except sqlite3.Error as e: return {"success": False, "message": f"Erro BD: {e}"}

def update_other_profile_name_logic(db_conn, data):
    """Atualiza o nome de um perfil de outro jogador."""
    profile_id = data.get('id')
    new_name = data.get('name', '').strip()
    if not profile_id or not new_name: return {"success": False, "message": "ID e novo nome são obrigatórios."}
    cursor = db_conn.cursor()
    try:
        cursor.execute("UPDATE outros_perfis_base SET nome_perfil = ? WHERE id_perfil = ?", (new_name, profile_id))
        db_conn.commit()
        return {"success": True, "message": "Nome do perfil atualizado."} if cursor.rowcount > 0 else {"success": False, "message": "Perfil não encontrado ou nome inalterado."}
    except sqlite3.IntegrityError: return {"success": False, "message": f"Nome '{new_name}' já existe."}
    except sqlite3.Error as e: return {"success": False, "message": f"Erro BD: {e}"}

def calculate_fpm_backend(farm, tempo_segundos):
    """Calcula o Farm Por Minuto."""
    try:
        farm_val = int(farm)
        tempo_val = int(tempo_segundos)
        if tempo_val <= 0 or farm_val < 0:
            return 0.0
        return (farm_val / tempo_val) * 60
    except (ValueError, TypeError):
        return None

def get_example_matches_logic(db_conn, data):
    """Busca as partidas de exemplo de um perfil."""
    profile_id = data.get('profile_id')
    if not profile_id: return {"success": False, "message": "ID do perfil não fornecido.", "matches": []}
    cursor = db_conn.cursor()
    cursor.execute("SELECT id_partida_exemplo, tempo_partida_segundos, farm_partida, fpm_calculado FROM outras_partidas_exemplo WHERE id_perfil_fk = ? ORDER BY id_partida_exemplo LIMIT 5", (profile_id,))
    matches = [{"id": r[0], "time_seconds": r[1], "farm": r[2], "fpm": r[3]} for r in cursor.fetchall()]
    avg_fpm = 0.0
    if matches:
        total_fpm = sum(m['fpm'] for m in matches if m['fpm'] is not None)
        count_fpm = sum(1 for m in matches if m['fpm'] is not None)
        if count_fpm > 0:
            avg_fpm = total_fpm / count_fpm
    return {"success": True, "matches": matches, "profile_avg_fpm": avg_fpm}

def add_example_match_logic(db_conn, data):
    """Adiciona uma partida de exemplo a um perfil."""
    profile_id = data.get('profile_id')
    tempo_segundos = data.get('time_seconds')
    farm = data.get('farm')
    if not profile_id: return {"success": False, "message": "ID do perfil não fornecido."}
    if tempo_segundos is None or farm is None: return {"success": False, "message": "Tempo e Farm são obrigatórios."}
    try:
        tempo_segundos = int(tempo_segundos); farm = int(farm)
        if not (farm >= 0 and tempo_segundos >= 0): raise ValueError("Valores inválidos.")
    except ValueError: return {"success": False, "message": "Tempo e Farm devem ser números válidos."}
    fpm_calculado = calculate_fpm_backend(farm, tempo_segundos)
    if fpm_calculado is None: return {"success": False, "message": "Não foi possível calcular FPM."}
    cursor = db_conn.cursor()
    try:
        cursor.execute("SELECT COUNT(*) FROM outras_partidas_exemplo WHERE id_perfil_fk = ?", (profile_id,))
        if cursor.fetchone()[0] >= 5: return {"success": False, "message": "Limite de 5 partidas de exemplo atingido para este perfil."}
        cursor.execute("INSERT INTO outras_partidas_exemplo (id_perfil_fk, tempo_partida_segundos, farm_partida, fpm_calculado) VALUES (?, ?, ?, ?)", (profile_id, tempo_segundos, farm, fpm_calculado))
        db_conn.commit()
        return {"success": True, "message": "Partida de exemplo adicionada!"}
    except sqlite3.Error as e: return {"success": False, "message": f"Erro BD: {e}"}

def update_example_match_logic(db_conn, data):
    """Atualiza uma partida de exemplo de um perfil."""
    match_id = data.get('match_id')
    profile_id = data.get('profile_id')
    tempo_segundos = data.get('time_seconds')
    farm = data.get('farm')
    if not match_id: return {"success": False, "message": "ID da partida não fornecido."}
    if tempo_segundos is None or farm is None: return {"success": False, "message": "Tempo e Farm são obrigatórios."}
    try:
        tempo_segundos = int(tempo_segundos); farm = int(farm)
        if not (farm >= 0 and tempo_segundos >= 0): raise ValueError("Valores inválidos.")
    except ValueError: return {"success": False, "message": "Tempo e Farm devem ser números válidos."}
    fpm_calculado = calculate_fpm_backend(farm, tempo_segundos)
    if fpm_calculado is None: return {"success": False, "message": "Não foi possível calcular FPM."}
    cursor = db_conn.cursor()
    try:
        cursor.execute("UPDATE outras_partidas_exemplo SET tempo_partida_segundos = ?, farm_partida = ?, fpm_calculado = ? WHERE id_partida_exemplo = ? AND id_perfil_fk = ?", (tempo_segundos, farm, fpm_calculado, match_id, profile_id))
        db_conn.commit()
        return {"success": True, "message": "Partida de exemplo atualizada!"} if cursor.rowcount > 0 else {"success": False, "message": "Partida não encontrada ou não pertence a este perfil."}
    except sqlite3.Error as e: return {"success": False, "message": f"Erro BD: {e}"}

def delete_example_match_logic(db_conn, data):
    """Exclui uma partida de exemplo de um perfil."""
    match_id = data.get('match_id')
    profile_id = data.get('profile_id')
    if not match_id: return {"success": False, "message": "ID da partida não fornecido."}
    if not profile_id: return {"success": False, "message": "ID do perfil não fornecido."}
    cursor = db_conn.cursor()
    try:
        cursor.execute("DELETE FROM outras_partidas_exemplo WHERE id_partida_exemplo = ? AND id_perfil_fk = ?", (match_id, profile_id))
        db_conn.commit()
        return {"success": True, "message": "Partida de exemplo excluída!"} if cursor.rowcount > 0 else {"success": False, "message": "Partida não encontrada ou não pertence a este perfil."}
    except sqlite3.Error as e: return {"success": False, "message": f"Erro BD: {e}"}

def register_gameplay_match_logic(db_conn, data):
    """Registra uma partida vinda da tela de Gameplay."""
    tempo_segundos = data.get('time_seconds')
    farm = data.get('farm')
    fpm = data.get('fpm')
    personagem = data.get('character')
    dificuldade = data.get('difficulty')
    if tempo_segundos is None or farm is None or fpm is None or dificuldade is None:
        return {"success": False, "message": "Dados incompletos para registrar partida."}
    try:
        tempo_s = int(tempo_segundos); farm_o = int(farm); fpm_c = float(fpm)
        if not (tempo_s > 0 and farm_o >= 0): return {"success": False, "message": "Tempo deve ser positivo e farm não negativo."}
    except (ValueError, TypeError) as e: return {"success": False, "message": f"Valores inválidos para tempo, farm ou FPM: {e}"}
    data_hora_atual = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    origem = "Cronômetro"
    cursor = db_conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO historico_partidas_usuario
            (data_hora, tempo_partida_segundos, farm_obtido, fpm_calculado, personagem_utilizado, dificuldade_partida, origem, avaliacao)
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
        """, (data_hora_atual, tempo_s, farm_o, fpm_c, personagem if personagem else None, dificuldade, origem))
        db_conn.commit()
        return {"success": True, "message": "Partida registrada com sucesso no histórico!"}
    except sqlite3.Error as e: return {"success": False, "message": f"Erro ao salvar partida no histórico: {e}"}

def get_single_profile_avg_fpm_logic(db_conn, data):
    """Busca o FPM médio para um único perfil."""
    profile_id = data.get('profile_id')
    if not profile_id: return {"success": False, "message": "ID do perfil não fornecido.", "avg_fpm": None}
    try: profile_id = int(profile_id)
    except ValueError: return {"success": False, "message": "ID do perfil inválido.", "avg_fpm": None}
    cursor = db_conn.cursor()
    cursor.execute("SELECT AVG(fpm_calculado) FROM outras_partidas_exemplo WHERE id_perfil_fk = ?", (profile_id,))
    result = cursor.fetchone()
    avg_fpm = result[0] if result and result[0] is not None else None
    return {"success": True, "avg_fpm": avg_fpm}

def get_historical_fpm_summary_logic(db_conn):
    """Busca um resumo simples do FPM histórico para a tela de Gameplay."""
    stats = {}
    cursor = db_conn.cursor()
    try:
        cursor.execute("SELECT AVG(fpm_calculado) FROM historico_partidas_usuario WHERE fpm_calculado IS NOT NULL")
        avg_geral = cursor.fetchone()
        stats["Média Geral"] = avg_geral[0] if avg_geral and avg_geral[0] is not None else None
        for dif in ["EASY", "NORMAL", "HARD"]:
            cursor.execute("SELECT AVG(fpm_calculado) FROM historico_partidas_usuario WHERE dificuldade_partida = ? AND fpm_calculado IS NOT NULL", (dif,))
            avg_dif = cursor.fetchone()
            stats[f"Média ({dif.capitalize()})"] = avg_dif[0] if avg_dif and avg_dif[0] is not None else None
        return {"success": True, "stats": stats}
    except sqlite3.Error as e: return {"success": False, "message": f"Erro ao buscar resumo do histórico: {e}", "stats": {}}

def add_manual_match_logic(db_conn, data):
    """Adiciona uma partida manualmente."""
    tempo_segundos = data.get('time_seconds')
    farm = data.get('farm')
    fpm = data.get('fpm')
    personagem = data.get('character')
    dificuldade = data.get('difficulty')
    if tempo_segundos is None or farm is None or fpm is None or dificuldade is None:
        return {"success": False, "message": "Dados incompletos para adicionar partida manual."}
    try:
        tempo_s = int(tempo_segundos)
        farm_o = int(farm)
        fpm_c = float(fpm)
        if not (tempo_s > 0 and farm_o >= 0):
            return {"success": False, "message": "Tempo deve ser positivo e farm não negativo."}
    except (ValueError, TypeError) as e:
        return {"success": False, "message": f"Valores inválidos para tempo, farm ou FPM: {e}"}
    data_hora_atual = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    origem = "Manual"
    cursor = db_conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO historico_partidas_usuario
            (data_hora, tempo_partida_segundos, farm_obtido, fpm_calculado, personagem_utilizado, dificuldade_partida, origem, avaliacao)
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
        """, (data_hora_atual, tempo_s, farm_o, fpm_c, personagem if personagem else None, dificuldade, origem))
        db_conn.commit()
        return {"success": True, "message": "Partida manual adicionada ao histórico!"}
    except sqlite3.Error as e:
        return {"success": False, "message": f"Erro ao salvar partida manual: {e}"}

def get_match_history_logic(db_conn):
    """Busca o histórico completo de partidas."""
    cursor = db_conn.cursor()
    try:
        cursor.execute("""
            SELECT id_partida_usuario, data_hora, tempo_partida_segundos, farm_obtido,
                   fpm_calculado, origem, dificuldade_partida, personagem_utilizado
            FROM historico_partidas_usuario
            ORDER BY id_partida_usuario DESC
        """)
        history = []
        for row in cursor.fetchall():
            history.append({
                "id": row[0],
                "data_hora": row[1],
                "tempo_segundos": row[2],
                "farm_obtido": row[3],
                "fpm_calculado": row[4],
                "origem": row[5],
                "dificuldade_partida": row[6],
                "personagem_utilizado": row[7]
            })
        return {"success": True, "history": history}
    except sqlite3.Error as e:
        return {"success": False, "message": f"Erro ao buscar histórico: {e}", "history": []}

def update_match_history_entry_logic(db_conn, data):
    """Atualiza uma entrada no histórico de partidas."""
    match_id = data.get('match_id')
    tempo_segundos = data.get('time_seconds')
    farm = data.get('farm')
    fpm = data.get('fpm')
    personagem = data.get('character')
    dificuldade = data.get('difficulty')
    if not match_id or tempo_segundos is None or farm is None or fpm is None or dificuldade is None:
        return {"success": False, "message": "Dados incompletos para atualizar partida."}
    try:
        match_id_val = int(match_id)
        tempo_s = int(tempo_segundos)
        farm_o = int(farm)
        fpm_c = float(fpm)
        if not (tempo_s > 0 and farm_o >= 0):
            return {"success": False, "message": "Tempo deve ser positivo e farm não negativo."}
    except (ValueError, TypeError) as e:
        return {"success": False, "message": f"Valores inválidos: {e}"}
    cursor = db_conn.cursor()
    try:
        cursor.execute("""
            UPDATE historico_partidas_usuario
            SET tempo_partida_segundos = ?, farm_obtido = ?, fpm_calculado = ?,
                personagem_utilizado = ?, dificuldade_partida = ?
            WHERE id_partida_usuario = ?
        """, (tempo_s, farm_o, fpm_c, personagem if personagem else None, dificuldade, match_id_val))
        db_conn.commit()
        if cursor.rowcount > 0:
            return {"success": True, "message": "Partida atualizada com sucesso!"}
        else:
            return {"success": False, "message": "Nenhuma partida encontrada com o ID fornecido para atualizar."}
    except sqlite3.Error as e:
        return {"success": False, "message": f"Erro ao atualizar partida: {e}"}

def delete_match_history_entry_logic(db_conn, data):
    """Exclui uma entrada do histórico de partidas."""
    match_id = data.get('match_id')
    if not match_id:
        return {"success": False, "message": "ID da partida não fornecido para exclusão."}
    try:
        match_id_val = int(match_id)
    except ValueError:
        return {"success": False, "message": "ID da partida inválido."}
    cursor = db_conn.cursor()
    try:
        cursor.execute("DELETE FROM historico_partidas_usuario WHERE id_partida_usuario = ?", (match_id_val,))
        db_conn.commit()
        if cursor.rowcount > 0:
            return {"success": True, "message": "Partida excluída do histórico com sucesso!"}
        else:
            return {"success": False, "message": "Nenhuma partida encontrada com o ID fornecido para excluir."}
    except sqlite3.Error as e:
        return {"success": False, "message": f"Erro ao excluir partida: {e}"}

def get_all_characters_logic(db_conn):
    """Busca uma lista de todos os personagens únicos já jogados."""
    cursor = db_conn.cursor()
    try:
        cursor.execute("SELECT DISTINCT personagem_utilizado FROM historico_partidas_usuario WHERE personagem_utilizado IS NOT NULL AND personagem_utilizado != '' ORDER BY personagem_utilizado")
        characters = [row[0] for row in cursor.fetchall()]
        return {"success": True, "characters": characters}
    except sqlite3.Error as e:
        return {"success": False, "message": f"Erro ao buscar personagens: {e}", "characters": []}

def get_filtered_stats_logic(db_conn, data):
    """Busca estatísticas completas, aplicando filtros se fornecidos."""
    character_filter = data.get('character_filter') if data else None

    stats = {
        "averages": {},
        "summary": {
            "top_character": None,
        },
        "chart_data": []
    }

    base_query = "FROM historico_partidas_usuario"
    params = []
    where_clauses = []

    if character_filter and character_filter != 'all':
        where_clauses.append("personagem_utilizado = ?")
        params.append(character_filter)

    cursor = db_conn.cursor()
    try:
        # Média Geral
        geral_clauses = list(where_clauses)
        geral_clauses.append("fpm_calculado IS NOT NULL")
        where_sql = " WHERE " + " AND ".join(geral_clauses)
        cursor.execute(f"SELECT AVG(fpm_calculado) {base_query} {where_sql}", params)
        avg_geral = cursor.fetchone()
        stats["averages"]["Média Geral"] = avg_geral[0] if avg_geral and avg_geral[0] is not None else None

        # Médias por dificuldade
        for dif in ["EASY", "NORMAL", "HARD"]:
            dif_clauses = list(where_clauses)
            dif_clauses.append("dificuldade_partida = ?")
            dif_clauses.append("fpm_calculado IS NOT NULL")
            where_sql = " WHERE " + " AND ".join(dif_clauses)
            cursor.execute(f"SELECT AVG(fpm_calculado) {base_query} {where_sql}", params + [dif])
            avg_dif = cursor.fetchone()
            stats["averages"][f"Média ({dif.capitalize()})"] = avg_dif[0] if avg_dif and avg_dif[0] is not None else None

        # Personagem mais jogado
        top_char_clauses = list(where_clauses)
        top_char_clauses.append("personagem_utilizado IS NOT NULL")
        top_char_clauses.append("personagem_utilizado != ''")
        where_sql = " WHERE " + " AND ".join(top_char_clauses)
        cursor.execute(f"SELECT personagem_utilizado {base_query} {where_sql}", params)

        characters = [row[0] for row in cursor.fetchall()]
        if characters:
            if character_filter and character_filter != 'all':
                stats["summary"]["top_character"] = character_filter
            else:
                stats["summary"]["top_character"] = Counter(characters).most_common(1)[0][0]

        # Dados para o gráfico
        where_sql = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        cursor.execute(f"SELECT data_hora, fpm_calculado {base_query} {where_sql} ORDER BY id_partida_usuario DESC LIMIT 15", params)
        stats["chart_data"] = [{"data_hora": row[0], "fpm_calculado": row[1]} for row in cursor.fetchall()]

        return {"success": True, "stats": stats}
    except sqlite3.Error as e:
        return {"success": False, "message": f"Erro ao buscar estatísticas: {e}", "stats": {}}


# --- PROCESSADOR DE REQUISIÇÕES ---

def process_request(action=None, data_payload=None):
    """Processa uma requisição vinda do main.js, chamando a função de lógica apropriada."""
    conn = None
    try:
        conn = setup_database() # Modificado para não precisar passar o caminho

        action_map = {
            "get_personal_goal": get_personal_goal_logic,
            "save_personal_goal": save_personal_goal_logic,
            "delete_personal_goal": delete_personal_goal_logic,
            "get_other_profiles": get_other_profiles_logic,
            "add_other_profile": add_other_profile_logic,
            "delete_other_profile": delete_other_profile_logic,
            "update_other_profile_name": update_other_profile_name_logic,
            "get_example_matches": get_example_matches_logic,
            "add_example_match": add_example_match_logic,
            "update_example_match": update_example_match_logic,
            "delete_example_match": delete_example_match_logic,
            "register_gameplay_match": register_gameplay_match_logic,
            "get_single_profile_avg_fpm": get_single_profile_avg_fpm_logic,
            "get_historical_fpm_summary": get_historical_fpm_summary_logic,
            "add_manual_match": add_manual_match_logic,
            "get_match_history": get_match_history_logic,
            "update_match_history_entry": update_match_history_entry_logic,
            "delete_match_history_entry": delete_match_history_entry_logic,
            "get_filtered_stats": get_filtered_stats_logic,
            "get_all_characters": get_all_characters_logic
        }

        logic_function = action_map.get(action)
        if logic_function:
            # Simplificado: passa o payload para todas as funções que podem precisar dele.
            if data_payload is not None:
                 return logic_function(conn, data_payload)
            else:
                 return logic_function(conn)
        else:
            return get_personal_goal_logic(conn)

    except Exception as e:
        print(f"Erro no process_request: {e}", file=sys.stderr)
        return {"error": str(e), "db_path_error": str(DATABASE_PATH), "success": False}
    finally:
        if conn: conn.close()

# --- PONTO DE ENTRADA DO SCRIPT ---

if __name__ == "__main__":
    # Esta inicialização de BD aqui não é estritamente necessária
    # se toda chamada passa por process_request, mas não prejudica.
    setup_database()

    input_str = sys.stdin.read()
    action_to_perform = "get_personal_goal"
    payload = None

    if input_str:
        try:
            input_json = json.loads(input_str)
            action_to_perform = input_json.get("action", "get_personal_goal")
            payload = input_json.get("payload")
        except json.JSONDecodeError:
            print(f"Erro: Input para backend.py não é JSON válido: {input_str}", file=sys.stderr)
            action_to_perform = "_invalid_json_input_"
            payload = {"raw_input": input_str}

    if action_to_perform == "_invalid_json_input_":
        result = {"success": False, "message": "Input para backend.py não era JSON válido.", "details": payload}
    else:
        result = process_request(action=action_to_perform, data_payload=payload)

    try:
        print(json.dumps(result))
    except TypeError as e:
        error_result = {"success": False, "message": f"Erro ao serializar resultado para JSON: {e}", "action": action_to_perform}
        print(json.dumps(error_result))
        print(f"Erro de serialização no backend para ação {action_to_perform}: {e}. Resultado problemático: {result}", file=sys.stderr)

    sys.stdout.flush()
    sys.stderr.flush()
